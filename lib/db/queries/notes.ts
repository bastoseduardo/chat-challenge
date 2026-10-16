import { after } from "next/server"
import { db } from "@/lib/db/client"
import { userNotes } from "@/lib/db/schema"
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm"
import { embedDocument, embedQuery, toVectorLiteral } from "@/lib/ai/embeddings"
import type { CreateNoteInput } from "@/lib/notes/schema"

// Colunas devolvidas ao cliente (sem o embedding).
const noteColumns = {
  id: userNotes.id,
  content: userNotes.content,
  title: userNotes.title,
  quote: userNotes.quote,
  sourceUrl: userNotes.sourceUrl,
  sourceTitle: userNotes.sourceTitle,
  sourcePage: userNotes.sourcePage,
  conversationId: userNotes.conversationId,
  messageId: userNotes.messageId,
  createdAt: userNotes.createdAt,
  updatedAt: userNotes.updatedAt,
}

export type Note = Omit<typeof userNotes.$inferSelect, "userId" | "embedding" | "deletedAt">

const own = (userId: string) => and(eq(userNotes.userId, userId), isNull(userNotes.deletedAt))

/** Texto usado pro embedding: título + trecho + conteúdo. */
function embeddingText(n: { title?: string | null; quote?: string | null; content: string }) {
  return [n.title, n.quote, n.content].filter((s) => s?.trim()).join("\n\n")
}

async function embedNote(id: string, text: string) {
  const vec = await embedDocument(text)
  if (!vec) return
  await db.execute(sql`
    UPDATE user_notes SET embedding = ${toVectorLiteral(vec)}::vector WHERE id = ${id}
  `)
}

/** Embedding em background quando há request (after); senão, sem bloquear. */
function scheduleEmbedding(id: string, text: string) {
  try {
    after(() => embedNote(id, text))
  } catch {
    void embedNote(id, text).catch((err) => console.error("[notes] embedding", err))
  }
}

export async function createNote(userId: string, input: CreateNoteInput): Promise<Note> {
  const content = input.content?.trim() || input.quote?.trim() || ""
  const [row] = await db
    .insert(userNotes)
    .values({
      userId,
      content,
      title: input.title ?? null,
      quote: input.quote ?? null,
      sourceUrl: input.source?.url ?? null,
      sourceTitle: input.source?.title ?? null,
      sourcePage: input.source?.page ?? null,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
    })
    .returning(noteColumns)
  scheduleEmbedding(row.id, embeddingText(row))
  return row as Note
}

// Paginação por keyset em (created_at truncado em ms, id): o JS só guarda
// milissegundos e o Postgres guarda microssegundos; comparar só a data pulava
// notas criadas no mesmo milissegundo da última da página.
const createdMs = sql`date_trunc('milliseconds', ${userNotes.createdAt})`

export function encodeNotesCursor(n: { createdAt: Date; id: string }): string {
  return `${n.createdAt.toISOString()}|${n.id}`
}

function decodeNotesCursor(cursor: string) {
  const [at, id] = cursor.split("|")
  return { at: new Date(at), id }
}

export async function listNotes(opts: {
  userId: string
  conversationId?: string
  cursor?: string
  limit?: number
}): Promise<Note[]> {
  const limit = opts.limit ?? 30
  return (await db
    .select(noteColumns)
    .from(userNotes)
    .where(
      and(
        own(opts.userId),
        opts.conversationId ? eq(userNotes.conversationId, opts.conversationId) : undefined,
        opts.cursor
          ? (() => {
              const c = decodeNotesCursor(opts.cursor)
              return sql`(${createdMs}, ${userNotes.id}) < (${c.at.toISOString()}::timestamptz, ${c.id}::uuid)`
            })()
          : undefined
      )
    )
    .orderBy(desc(createdMs), desc(userNotes.id))
    .limit(limit)) as Note[]
}

export async function getNote(userId: string, id: string): Promise<Note | null> {
  const [row] = await db
    .select(noteColumns)
    .from(userNotes)
    .where(and(eq(userNotes.id, id), own(userId)))
    .limit(1)
  return (row as Note) ?? null
}

export async function updateNote(
  userId: string,
  id: string,
  patch: { content?: string; title?: string | null }
): Promise<Note | null> {
  const [row] = await db
    .update(userNotes)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(userNotes.id, id), own(userId)))
    .returning(noteColumns)
  if (row && (patch.content !== undefined || patch.title !== undefined)) {
    scheduleEmbedding(row.id, embeddingText(row))
  }
  return (row as Note) ?? null
}

export async function softDeleteNote(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(userNotes)
    .set({ deletedAt: new Date() })
    .where(and(eq(userNotes.id, id), own(userId)))
    .returning({ id: userNotes.id })
  return rows.length > 0
}

export async function restoreNote(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(userNotes)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(eq(userNotes.id, id), eq(userNotes.userId, userId), isNotNull(userNotes.deletedAt)))
    .returning({ id: userNotes.id })
  return rows.length > 0
}

/**
 * Notas mais parecidas com um texto, por similaridade de cosseno. Usada pela
 * busca e pela R4-006 (caderno como contexto).
 */
export async function similarNotes(opts: {
  userId: string
  text: string
  limit?: number
  minSimilarity?: number
}): Promise<Array<Note & { similarity: number }>> {
  const vec = toVectorLiteral(await embedQuery(opts.text))
  const distance = sql`${userNotes.embedding} <=> ${vec}::vector`
  const rows = await db
    .select({ ...noteColumns, similarity: sql<number>`1 - (${distance})` })
    .from(userNotes)
    .where(and(own(opts.userId), isNotNull(userNotes.embedding)))
    .orderBy(distance)
    .limit(opts.limit ?? 10)
  const min = opts.minSimilarity ?? 0
  return (rows as Array<Note & { similarity: number }>).filter((r) => Number(r.similarity) >= min)
}

/**
 * Busca do Caderno: correspondência de texto primeiro, depois por significado.
 * Se o embedding falhar, fica só com o texto.
 */
export async function searchNotes(userId: string, q: string, limit = 20): Promise<Note[]> {
  // A barra invertida é o escape do LIKE: escapa ela também, senão uma busca
  // por um caminho do Windows não casa.
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const byText = (await db
    .select(noteColumns)
    .from(userNotes)
    .where(
      and(
        own(userId),
        or(ilike(userNotes.content, pattern), ilike(userNotes.quote, pattern), ilike(userNotes.title, pattern))
      )
    )
    .orderBy(desc(userNotes.createdAt))
    .limit(limit)) as Note[]

  let byMeaning: Note[] = []
  try {
    byMeaning = await similarNotes({ userId, text: q, limit, minSimilarity: 0.3 })
  } catch (err) {
    console.error("[notes] busca por significado indisponível", err)
  }

  const seen = new Set<string>()
  const merged: Note[] = []
  for (const n of [...byText, ...byMeaning]) {
    if (seen.has(n.id)) continue
    seen.add(n.id)
    merged.push(n)
  }
  return merged.slice(0, limit)
}
