import { db } from "@/lib/db/client"
import { userNotes } from "@/lib/db/schema"
import { eq, desc, and, sql } from "drizzle-orm"

export async function saveNote(userId: string, content: string) {
  const [row] = await db
    .insert(userNotes)
    .values({ userId, content })
    .returning({ id: userNotes.id, createdAt: userNotes.createdAt })
  return row
}

export async function listNotes(userId: string, limit = 20) {
  return db
    .select()
    .from(userNotes)
    .where(eq(userNotes.userId, userId))
    .orderBy(desc(userNotes.createdAt))
    .limit(limit)
}

export async function searchNotes(userId: string, query: string, limit = 10) {
  return db
    .select()
    .from(userNotes)
    .where(
      and(
        eq(userNotes.userId, userId),
        sql`${userNotes.content} ilike ${"%" + query + "%"}`
      )
    )
    .orderBy(desc(userNotes.createdAt))
    .limit(limit)
}
