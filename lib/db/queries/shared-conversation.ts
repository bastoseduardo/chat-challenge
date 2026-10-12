import { createServiceClient } from "@/lib/supabase/service"
import { createSignedDownloadUrl } from "@/lib/storage/attachments"
import type { UIMessage } from "ai"

interface SharedRow {
  conversation: {
    id: string
    title: string
    created_at: string
    compaction_count: number
  }
  messages: Array<{
    id: string
    role: string
    content: unknown
    is_summary: boolean
    created_at: string
  }>
}

type TextPart = { type: "text"; text: string }
type FilePart = { type: "file"; mediaType: string; url: string; filename?: string }

export async function loadSharedConversation(
  token: string
): Promise<{
  conversation: SharedRow["conversation"]
  messages: UIMessage[]
} | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.rpc("get_shared_conversation", { p_token: token })
  const shared = data as SharedRow | null
  if (!shared) return null

  // Fetch attachments for all messages in bulk
  const messageIds = shared.messages.filter((m) => !m.is_summary).map((m) => m.id)
  let attachmentsByMessage = new Map<string, Array<{ storage_path: string; mime_type: string; original_name: string | null }>>()
  if (messageIds.length > 0) {
    const { data: atts } = await supabase
      .from("attachments")
      .select("message_id, storage_path, mime_type, original_name")
      .in("message_id", messageIds)
    for (const a of atts ?? []) {
      const list = attachmentsByMessage.get(a.message_id) ?? []
      list.push({
        storage_path: a.storage_path,
        mime_type: a.mime_type,
        original_name: a.original_name,
      })
      attachmentsByMessage.set(a.message_id, list)
    }
  }

  const messages: UIMessage[] = []
  for (const m of shared.messages) {
    if (m.is_summary) continue
    const parts: Array<TextPart | FilePart> = Array.isArray(m.content)
      ? (m.content as Array<TextPart | FilePart>).filter(
          (p) => p.type === "text" || p.type === "file"
        )
      : []
    const atts = attachmentsByMessage.get(m.id) ?? []
    for (const a of atts) {
      try {
        const url = await createSignedDownloadUrl(a.storage_path)
        parts.push({
          type: "file",
          mediaType: a.mime_type,
          url,
          filename: a.original_name ?? undefined,
        })
      } catch (err) {
        console.error("[share] signed URL failed:", err)
      }
    }
    messages.push({
      id: m.id,
      role: m.role as UIMessage["role"],
      parts: parts as unknown as UIMessage["parts"],
    })
  }

  return { conversation: shared.conversation, messages }
}
