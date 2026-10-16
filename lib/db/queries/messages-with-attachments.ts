import { db } from "@/lib/db/client"
import { messages, attachments, toolInvocations } from "@/lib/db/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import { createSignedDownloadUrl } from "@/lib/storage/attachments"
import type { UIMessage } from "ai"

type FilePart = {
  type: "file"
  mediaType: string
  url: string
  filename?: string
}

type TextPart = { type: "text"; text: string }

type DynamicToolPart = {
  type: "dynamic-tool"
  toolCallId: string
  toolName: string
  state: "output-available" | "output-error"
  input: unknown
  output?: unknown
  errorText?: string
}

type Part = TextPart | FilePart | DynamicToolPart

/**
 * Carrega mensagens + anexos + tool invocations de uma conversa pro cliente.
 * Reconstrói parts no formato UIMessage, incluindo signed URLs e tool call cards.
 */
export async function listMessagesWithAttachments(
  conversationId: string
): Promise<UIMessage[]> {
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt))

  const result: UIMessage[] = []

  for (const row of rows) {
    if (row.isSummary) continue
    const basePartsRaw = Array.isArray(row.content) ? (row.content as Part[]) : []

    // Formato novo (SPEC-R4-001): a resposta foi salva com as parts completas
    // do stream (ferramentas, fontes, citações). Usar como está. Mensagens
    // antigas só têm texto e são remontadas abaixo a partir de tool_invocations.
    if (row.role === "assistant" && basePartsRaw.some((p) => p.type !== "text")) {
      result.push({
        id: row.id,
        role: "assistant",
        parts: basePartsRaw as unknown as UIMessage["parts"],
        ...(row.model && { metadata: { model: row.model } }),
      })
      continue
    }
    const textParts: TextPart[] = basePartsRaw.filter(
      (p): p is TextPart => p.type === "text"
    )
    const fileParts: FilePart[] = basePartsRaw.filter(
      (p): p is FilePart => p.type === "file"
    )

    // Anexos (user messages)
    const atts = await db
      .select()
      .from(attachments)
      .where(eq(attachments.messageId, row.id))
    for (const a of atts) {
      try {
        const url = await createSignedDownloadUrl(a.storagePath)
        fileParts.push({
          type: "file",
          mediaType: a.mimeType,
          url,
          filename: a.originalName ?? undefined,
        })
      } catch (err) {
        console.error("[messages] attachment URL failed:", err)
      }
    }

    // Tool invocations (assistant messages) — ordena por criação
    let toolParts: DynamicToolPart[] = []
    if (row.role === "assistant") {
      const invs = await db
        .select()
        .from(toolInvocations)
        .where(eq(toolInvocations.messageId, row.id))
        .orderBy(asc(toolInvocations.createdAt))
      toolParts = invs.map((inv) => ({
        type: "dynamic-tool" as const,
        toolCallId: inv.id,
        toolName: inv.toolName,
        state: inv.error ? "output-error" : "output-available",
        input: inv.args,
        output: inv.result ?? undefined,
        errorText: inv.error ?? undefined,
      }))
    }

    // Ordem na thread: file parts primeiro, depois tool calls, depois text (resposta final)
    const parts: Part[] = [...fileParts, ...toolParts, ...textParts]

    result.push({
      id: row.id,
      role: row.role as UIMessage["role"],
      parts: parts as unknown as UIMessage["parts"],
      ...(row.role === "assistant" && row.model && { metadata: { model: row.model } }),
    })
  }

  return result
}
