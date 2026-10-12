import { db } from "@/lib/db/client"
import { messages, attachments } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { createSignedDownloadUrl } from "@/lib/storage/attachments"
import type { UIMessage } from "ai"

type FilePart = {
  type: "file"
  mediaType: string
  url: string
  filename?: string
}

type TextPart = { type: "text"; text: string }

/**
 * Carrega mensagens + anexos de uma conversa pro cliente, incluindo signed URLs.
 */
export async function listMessagesWithAttachments(
  conversationId: string
): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt))

  const result: UIMessage[] = []

  for (const row of rows) {
    if (row.isSummary) continue
    const parts: Array<TextPart | FilePart> = Array.isArray(row.content)
      ? (row.content as Array<TextPart | FilePart>).filter(
          (p) => p.type === "text" || p.type === "file"
        )
      : []

    const atts = await db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, row.id))

    for (const a of atts) {
      try {
        const url = await createSignedDownloadUrl(a.storagePath)
        parts.push({
          type: "file",
          mediaType: a.mimeType,
          url,
          filename: a.originalName ?? undefined,
        })
      } catch (err) {
        console.error("[messages] attachment URL failed:", err)
      }
    }

    result.push({
      id: row.id,
      role: row.role as UIMessage["role"],
      parts: parts as unknown as UIMessage["parts"],
    })
  }

  return result
}
