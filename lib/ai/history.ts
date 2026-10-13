import { db } from "@/lib/db/client"
import { messages, attachments as attachmentsTable } from "@/lib/db/schema"
import { and, eq, gt, isNotNull, desc, asc } from "drizzle-orm"
import { createSignedDownloadUrl } from "@/lib/storage/attachments"
import type { ModelMessage } from "ai"

/**
 * Carrega o contexto da conversa pro modelo:
 * - Se há summary message, começa dela
 * - Depois lista mensagens criadas após o último summary
 * - Expande anexos (image/pdf) como content parts com bytes do Storage
 */
export async function buildContext(conversationId: string): Promise<ModelMessage[]> {
  const [lastSummary] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.isSummary, true)))
    .orderBy(desc(messages.createdAt))
    .limit(1)

  const since = lastSummary?.createdAt ?? new Date(0)

  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), gt(messages.createdAt, since)))
    .orderBy(asc(messages.createdAt))

  const out: ModelMessage[] = []

  if (lastSummary) {
    const summaryText = extractText(lastSummary.content)
    out.push({
      role: "system",
      content:
        "Resumo do histórico anterior (gerado por auto-compaction):\n\n" + summaryText,
    })
  }

  for (const row of rows) {
    const parts = Array.isArray(row.content) ? (row.content as Array<Record<string, unknown>>) : []
    const text = parts
      .filter((p) => (p as { type?: string }).type === "text")
      .map((p) => (p as { text?: string }).text ?? "")
      .join("")

    if (row.role === "user") {
      const content: Array<Record<string, unknown>> = []
      if (text) content.push({ type: "text", text })
      // attach any file parts for this message
      const atts = await db
        .select()
        .from(attachmentsTable)
        .where(and(eq(attachmentsTable.messageId, row.id), isNotNull(attachmentsTable.storagePath)))
      for (const a of atts) {
        try {
          // Passa signed URL (não baixa bytes aqui) — Anthropic busca direto.
          const url = await createSignedDownloadUrl(a.storagePath)
          content.push({
            type: "file",
            data: url,
            mediaType: a.mimeType,
            filename: a.originalName ?? undefined,
          })
        } catch (err) {
          console.error("[history] attachment URL failed:", err)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      out.push({ role: "user", content: content as any })
    } else if (row.role === "assistant") {
      out.push({ role: "assistant", content: text })
    }
    // system/tool rows are skipped — tool invocations rebuilt from args/output
  }

  // Prompt caching da Anthropic: marca a última mensagem estável como cache boundary.
  // Tudo antes dela é cacheado (até 1h), bate ~90% desconto em cache hits.
  // Usamos a penúltima pra evitar invalidar o cache no stream atual (a última ainda está "quente").
  if (out.length >= 2) {
    const anchor = out[out.length - 2] as ModelMessage & {
      providerOptions?: Record<string, unknown>
    }
    anchor.providerOptions = {
      ...(anchor.providerOptions ?? {}),
      anthropic: { cacheControl: { type: "ephemeral" } },
    }
  }

  return out
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((p): p is { type: "text"; text: string } => {
      const o = p as { type?: string; text?: string }
      return o.type === "text" && typeof o.text === "string"
    })
    .map((p) => p.text)
    .join("\n")
}
