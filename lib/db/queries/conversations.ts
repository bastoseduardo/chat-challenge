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

export async function createConversation(userId: string, title = "Nova conversa") {
  const [row] = await db
    .insert(conversations)
    .values({ userId, title })
    .returning()
  return row
}

export async function renameConversation(id: string, userId: string, title: string) {
  await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
}

export async function softDeleteConversation(id: string, userId: string) {
  await db
    .update(conversations)
    .set({ deletedAt: new Date() })
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
