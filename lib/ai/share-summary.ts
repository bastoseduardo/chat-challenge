import { generateText, type UIMessage } from "ai"
import { and, asc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"
import { getModel } from "@/lib/ai/client"
import { DEFAULT_MODEL } from "@/lib/ai/pricing"
import { recordUsage } from "@/lib/usage/counter"
import { textWithCitations } from "@/lib/sources/extract"

const MAX_TRANSCRIPT_CHARS = 40_000

/** Transcrição em texto puro (usuário/assistente), sem marcas de citação. */
async function transcript(conversationId: string): Promise<string> {
  const rows = await db
    .select({ id: messages.id, role: messages.role, content: messages.content })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.isSummary, false), isNull(messages.deletedAt)))
    .orderBy(asc(messages.createdAt))

  const lines = rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .map((r) => {
      const msg = { id: r.id, role: r.role, parts: Array.isArray(r.content) ? r.content : [] } as unknown as UIMessage
      const text = textWithCitations(msg).trim()
      return text ? `${r.role === "user" ? "Usuário" : "Assistente"}: ${text}` : ""
    })
    .filter(Boolean)

  let out = lines.join("\n\n")
  // Conversas longas: mantém o começo (a pergunta) e o fim (as conclusões).
  if (out.length > MAX_TRANSCRIPT_CHARS) {
    const half = MAX_TRANSCRIPT_CHARS / 2
    out = `${out.slice(0, half)}\n\n[...]\n\n${out.slice(-half)}`
  }
  return out
}

/**
 * Resumo do relatório compartilhado (SPEC-R4-007): um parágrafo + até 4
 * conclusões. Devolve null se a conversa não tiver texto ou se a geração falhar
 * (o compartilhamento não depende do resumo).
 */
export async function generateShareSummary(opts: {
  conversationId: string
  userId: string
}): Promise<string | null> {
  try {
    const text = await transcript(opts.conversationId)
    if (!text) return null

    const result = await generateText({
      model: getModel(DEFAULT_MODEL),
      prompt: `Resuma a conversa abaixo para quem vai ler um relatório compartilhado dela.

Formato:
- Um parágrafo de 3 a 5 frases: o que foi perguntado e o que se concluiu.
- Depois, se houver, até 4 conclusões curtas, cada uma numa linha começando com "- ".

Regras: português do Brasil; só o que está na conversa, sem inventar; sem títulos; responda apenas com o resumo.

<conversa>
${text}
</conversa>`,
    })

    if (result.usage) {
      await recordUsage({
        userId: opts.userId,
        conversationId: opts.conversationId,
        model: DEFAULT_MODEL,
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        eventKind: "tool_llm",
      })
    }
    const summary = result.text.trim()
    return summary || null
  } catch (err) {
    console.error("[share-summary] falha ao gerar resumo", err)
    return null
  }
}
