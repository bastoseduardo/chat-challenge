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
  /** v2 da função (drizzle/sql/006_share_function_v2.sql); ausente na v1. */
  share?: {
    summary: string | null
    summary_generated_at: string | null
    created_at: string
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
type DynamicToolPart = {
  type: "dynamic-tool"
  toolCallId: string
  toolName: string
  state: "output-available" | "output-error"
  input: unknown
  output?: unknown
  errorText?: string
}

/**
 * Partes que ficam fora do relatório público: as notas do caderno usadas como
 * contexto (SPEC-R4-006) são privadas. A função SQL v4 já as remove; o filtro
 * aqui cobre a v3 e qualquer leitura direta.
 */
const PRIVATE_PART_TYPES = new Set(["data-notes-used"])

export async function loadSharedConversation(
  token: string
): Promise<{
  conversation: SharedRow["conversation"]
  share: SharedRow["share"] | null
  messages: UIMessage[]
} | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.rpc("get_shared_conversation", { p_token: token })
  const shared = data as SharedRow | null
  if (!shared) return null

  const visibleMessages = shared.messages.filter((m) => !m.is_summary)
  const messageIds = visibleMessages.map((m) => m.id)
  const assistantIds = visibleMessages
    .filter((m) => m.role === "assistant")
    .map((m) => m.id)

  // Fetch anexos + tool invocations em bulk
  const attachmentsByMessage = new Map<
    string,
    Array<{ storage_path: string; mime_type: string; original_name: string | null }>
  >()
  const toolsByMessage = new Map<
    string,
    Array<{
      id: string
      tool_name: string
      args: unknown
      result: unknown
      error: string | null
      created_at: string
    }>
  >()

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

  if (assistantIds.length > 0) {
    const { data: invs } = await supabase
      .from("tool_invocations")
      .select("id, message_id, tool_name, args, result, error, created_at")
      .in("message_id", assistantIds)
      .order("created_at", { ascending: true })
    for (const inv of invs ?? []) {
      const list = toolsByMessage.get(inv.message_id) ?? []
      list.push(inv)
      toolsByMessage.set(inv.message_id, list)
    }
  }

  const messages: UIMessage[] = []
  for (const m of visibleMessages) {
    const basePartsRaw = Array.isArray(m.content)
      ? (m.content as Array<TextPart | FilePart>).filter((p) => !PRIVATE_PART_TYPES.has(p.type))
      : []

    // Formato novo (SPEC-R4-001): parts completas salvas, inclusive citações.
    if (m.role === "assistant" && basePartsRaw.some((p) => p.type !== "text")) {
      messages.push({
        id: m.id,
        role: "assistant",
        parts: basePartsRaw as unknown as UIMessage["parts"],
      })
      continue
    }
    const textParts = basePartsRaw.filter((p): p is TextPart => p.type === "text")
    const fileParts: FilePart[] = basePartsRaw.filter(
      (p): p is FilePart => p.type === "file"
    )

    for (const a of attachmentsByMessage.get(m.id) ?? []) {
      try {
        const url = await createSignedDownloadUrl(a.storage_path)
        fileParts.push({
          type: "file",
          mediaType: a.mime_type,
          url,
          filename: a.original_name ?? undefined,
        })
      } catch (err) {
        console.error("[share] signed URL failed:", err)
      }
    }

    const toolParts: DynamicToolPart[] = (toolsByMessage.get(m.id) ?? []).map(
      (inv) => ({
        type: "dynamic-tool",
        toolCallId: inv.id,
        toolName: inv.tool_name,
        state: inv.error ? "output-error" : "output-available",
        input: inv.args,
        output: inv.result ?? undefined,
        errorText: inv.error ?? undefined,
      })
    )

    const parts = [...fileParts, ...toolParts, ...textParts]
    messages.push({
      id: m.id,
      role: m.role as UIMessage["role"],
      parts: parts as unknown as UIMessage["parts"],
    })
  }

  return { conversation: shared.conversation, share: shared.share ?? null, messages }
}
