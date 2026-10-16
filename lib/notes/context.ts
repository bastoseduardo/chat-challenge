import type { ModelMessage } from "ai"
import { rerank } from "@/lib/ai/embeddings"
import { similarNotes, type Note } from "@/lib/db/queries/notes"

// Caderno como contexto (SPEC-R4-006): a cada pergunta, até 3 notas parecidas
// vão junto, e a trilha mostra quais foram.

// Duas etapas, calibradas com 17 perguntas (tabela na spec): o cosseno dos
// embeddings só pré-seleciona (em textos curtos ele não separa relevante de
// irrelevante: "que horas são em Lisboa" dava 0,42 contra uma nota sobre RLS),
// e o rerank decide.
export const NOTES_CONTEXT_CANDIDATES = 8
export const NOTES_CONTEXT_MIN_SIMILARITY = 0.2
/** Relevância mínima no rerank (rerank-2.5-lite): irrelevantes ficaram ≤ 0,35. */
export const NOTES_CONTEXT_MIN_RELEVANCE = 0.38
/** Sem rerank (falhou), só passa nota muito parecida pelo cosseno. */
export const NOTES_CONTEXT_FALLBACK_SIMILARITY = 0.6
export const NOTES_CONTEXT_LIMIT = 3

export interface NotesUsedData {
  notes: Array<{ id: string; title: string; quote: string | null }>
}

/** Notas relevantes pra pergunta; falha no embedding = nenhuma nota. */
export async function findContextNotes(userId: string, text: string): Promise<Note[]> {
  if (text.trim().length < 8) return []
  let candidates: Array<Note & { similarity: number }>
  try {
    candidates = await similarNotes({
      userId,
      text,
      limit: NOTES_CONTEXT_CANDIDATES,
      minSimilarity: NOTES_CONTEXT_MIN_SIMILARITY,
    })
  } catch (err) {
    console.error("[notes] contexto do caderno indisponível", err)
    return []
  }
  if (candidates.length === 0) return []
  try {
    const scores = await rerank(text, candidates.map(noteText))
    return candidates
      .map((note, i) => ({ note, score: scores[i] }))
      .filter((c) => c.score >= NOTES_CONTEXT_MIN_RELEVANCE)
      .sort((a, b) => b.score - a.score)
      .slice(0, NOTES_CONTEXT_LIMIT)
      .map((c) => c.note)
  } catch (err) {
    console.error("[notes] rerank indisponível, usando só o cosseno", err)
    return candidates
      .filter((c) => Number(c.similarity) >= NOTES_CONTEXT_FALLBACK_SIMILARITY)
      .slice(0, NOTES_CONTEXT_LIMIT)
  }
}

function noteText(n: Note): string {
  return [n.title, n.quote, n.content].filter(Boolean).join("\n")
}

function firstLine(text: string, max = 80): string {
  const line = text.trim().split("\n")[0] ?? ""
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function sourceOf(n: Note): string | null {
  if (!n.sourceTitle && !n.sourceUrl) return null
  const label = n.sourceTitle ?? n.sourceUrl!
  return n.sourcePage ? `${label}, p. ${n.sourcePage}` : label
}

export function notesUsedData(notes: Note[]): NotesUsedData {
  return {
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title?.trim() || firstLine(n.quote || n.content),
      quote: n.quote ? firstLine(n.quote, 160) : null,
    })),
  }
}

function notesBlock(notes: Note[]): string {
  const lines = notes.map((n, i) => {
    const body = [n.title, n.quote && `"${n.quote}"`, n.content].filter(Boolean).join(" — ")
    const source = sourceOf(n)
    return `- [nota ${i + 1}] ${body.slice(0, 1500)}${source ? ` (fonte: ${source})` : ""}`
  })
  return [
    "<user_notes>",
    'Notas que o usuário guardou no caderno e que podem ser relevantes. Use só se ajudarem a responder; quando usar, diga que veio "das suas notas".',
    ...lines,
    "</user_notes>",
  ].join("\n")
}

/**
 * As notas entram na ÚLTIMA mensagem do usuário, não no `system`: o prefixo
 * (ferramentas + system + histórico até o cache breakpoint do buildContext)
 * fica igual entre turnos e o prompt caching continua batendo.
 */
export function withNotesContext(messages: ModelMessage[], notes: Note[]): ModelMessage[] {
  const last = messages[messages.length - 1]
  if (notes.length === 0 || !last || last.role !== "user") return messages
  const block = { type: "text" as const, text: notesBlock(notes) }
  const content = typeof last.content === "string" ? [{ type: "text" as const, text: last.content }] : last.content
  return [...messages.slice(0, -1), { ...last, content: [block, ...content] }]
}
