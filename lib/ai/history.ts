import { db } from "@/lib/db/client"
import { messages, attachments as attachmentsTable } from "@/lib/db/schema"
import { and, eq, gt, isNotNull, isNull, asc } from "drizzle-orm"
import { createSignedDownloadUrl } from "@/lib/storage/attachments"
import { loadWindowStart } from "@/lib/ai/context-window"
import type { ModelMessage, UIMessage } from "ai"
import { textWithCitations } from "@/lib/sources/extract"

export interface ConversationContext {
  messages: ModelMessage[]
  /** Resumo da compactação, pro `system` (o AI SDK 7 recusa mensagens system no histórico). */
  summary: string | null
}

/**
 * Carrega o contexto da conversa pro modelo:
 * - O último resumo de compactação vai à parte (`summary`), pro system prompt
 * - Depois lista as mensagens após a última resumida (inclui as recentes que
 *   a compactação manteve fora do resumo)
 * - Expande anexos (image/pdf) como content parts com bytes do Storage
 */
export async function buildContext(conversationId: string): Promise<ConversationContext> {
  const { lastSummary, since } = await loadWindowStart(conversationId)

  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        gt(messages.createdAt, since),
        eq(messages.isSummary, false),
        isNull(messages.deletedAt)
      )
    )
    .orderBy(asc(messages.createdAt))

  const out: ModelMessage[] = []
  const summary = lastSummary ? extractText(lastSummary.content).trim() || null : null

  for (const row of rows) {
    const parts = Array.isArray(row.content) ? (row.content as Array<Record<string, unknown>>) : []
    // Blocos de texto separados por uma ferramenta não podem sair colados
    // ("Vou pesquisar.A resposta é X"): textWithCitations põe parágrafo entre
    // etapas e mantém juntos os trechos citados da mesma frase.
    const text = textWithCitations({ id: row.id, role: row.role, parts } as unknown as UIMessage)

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
            // PDFs com citações nativas: a resposta traz trecho + página
            // (SPEC-R4-003). A API exige citações em todos os documentos ou
            // em nenhum; ligamos em todos os PDFs.
            ...(a.mimeType === "application/pdf" && {
              providerOptions: {
                anthropic: {
                  citations: { enabled: true },
                  title: a.originalName ?? "documento.pdf",
                },
              },
            }),
          })
        } catch (err) {
          console.error("[history] attachment URL failed:", err)
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      out.push({ role: "user", content: content as any })
    } else if (row.role === "assistant") {
      // Pula assistant msgs sem text (ex: só tool_calls que não escreveram
      // texto final). O histórico não precisa dessas, e enviá-las com
      // content: "" quebra ao marcar cacheControl + atrapalha o modelo.
      if (!text.trim()) continue
      out.push({ role: "assistant", content: text })
    }
    // system/tool rows are skipped — tool invocations rebuilt from args/output
  }

  // Prompt caching da Anthropic: marca a última mensagem estável com conteúdo
  // não-vazio como cache boundary. Tudo antes dela é cacheado (até 1h).
  // Importante: Anthropic rejeita cacheControl em text blocks vazios (ex: uma
  // assistant msg que só chamou tool sem escrever texto). Por isso procuramos
  // de trás pra frente a última msg com conteúdo real.
  for (let i = out.length - 2; i >= 0; i--) {
    const msg = out[i] as ModelMessage & {
      providerOptions?: Record<string, unknown>
    }
    const hasContent =
      typeof msg.content === "string"
        ? msg.content.trim().length > 0
        : Array.isArray(msg.content) && msg.content.length > 0
    if (!hasContent) continue
    msg.providerOptions = {
      ...(msg.providerOptions ?? {}),
      anthropic: { cacheControl: { type: "ephemeral" } },
    }
    break
  }

  // Depois de um resumo, o trecho mantido pode começar por uma resposta; a API
  // espera que a conversa comece pelo usuário.
  if (summary && out[0]?.role === "assistant") {
    out.unshift({ role: "user", content: "(Continuação da conversa resumida no system prompt.)" })
  }

  return { messages: out, summary }
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
