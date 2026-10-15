import { db } from "@/lib/db/client"
import { conversations, messages } from "@/lib/db/schema"
import { and, eq, isNull, desc, asc } from "drizzle-orm"

export async function listConversations(userId: string) {
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt,
      compactionCount: conversations.compactionCount,
    })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), isNull(conversations.deletedAt)))
    .orderBy(desc(conversations.updatedAt))
}

export async function getConversation(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, id),
        eq(conversations.userId, userId),
        isNull(conversations.deletedAt)
      )
    )
    .limit(1)
  return row ?? null
}

/**
 * Cria a conversa com um id gerado no cliente. Idempotente: se o id já existe
 * e é do mesmo usuário, devolve a existente com `created: false`. Se pertence
 * a outro usuário, devolve null (o caller responde 409).
 */
export async function createConversationWithId(id: string, userId: string) {
  const [inserted] = await db
    .insert(conversations)
    .values({ id, userId, title: "Nova conversa" })
    .onConflictDoNothing({ target: conversations.id })
    .returning()
  if (inserted) return { row: inserted, created: true }

  const [existing] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1)
  if (!existing || existing.userId !== userId) return null
  return { row: existing, created: false }
}

export async function renameConversation(id: string, userId: string, title: string) {
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
}

export async function updateConversation(
  id: string,
  userId: string,
  patch: { title?: string; model?: string; systemPrompt?: string | null }
) {
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.title !== undefined) set.title = patch.title
  if (patch.model !== undefined) set.model = patch.model
  if (patch.systemPrompt !== undefined) set.systemPrompt = patch.systemPrompt
  await db
    .update(conversations)
    .set(set)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
}

export async function softDeleteConversation(id: string, userId: string) {
  await db
    .update(conversations)
    .set({ deletedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
}

export async function restoreConversation(id: string, userId: string) {
  await db
    .update(conversations)
    .set({ deletedAt: null })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
}

export async function touchConversation(id: string) {
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, id))
}

export async function listMessages(conversationId: string) {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))
}
