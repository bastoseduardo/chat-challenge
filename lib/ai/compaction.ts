import { generateText } from "ai"
import { eq, and, gt, sql, asc } from "drizzle-orm"
import { after } from "next/server"
import { db } from "@/lib/db/client"
import { conversations, messages } from "@/lib/db/schema"
import { getModel } from "@/lib/ai/client"
import { DEFAULT_MODEL, MODEL_CTX_WINDOW } from "@/lib/ai/pricing"
import { recordUsage } from "@/lib/usage/counter"
import { logAudit } from "@/lib/audit/log"

const KEEP_RECENT = 10

function threshold(): number {
  const n = Number(process.env.COMPACTION_THRESHOLD)
  return Number.isFinite(n) && n > 0 && n < 1 ? n : 0.8
}

function ctxWindow(model: string): number {
  const fromMap = MODEL_CTX_WINDOW[model]
  if (fromMap) return fromMap
  const fromEnv = Number(process.env.MODEL_CONTEXT_WINDOW)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 200_000
}

/**
 * Dispara compaction em background (via waitUntil / after).
 */
export function scheduleCompaction(opts: {
  conversationId: string
  userId: string
  model: string
}): void {
  after(async () => {
    try {
      await compactIfNeeded(opts)
    } catch (err) {
      console.error("[compaction] failed:", err)
    }
  })
}

export async function compactIfNeeded(opts: {
  conversationId: string
  userId: string
  model: string
}): Promise<void> {
  const { conversationId, userId, model } = opts

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)
  if (!conv) return

  const totalTokens = conv.totalInputTokens + conv.totalOutputTokens
  const limit = ctxWindow(model)
  if (totalTokens < threshold() * limit) return

  // Pega msgs desde o último summary
  const [lastSummary] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.isSummary, true)))
    .orderBy(sql`${messages.createdAt} desc`)
    .limit(1)

  const since = lastSummary?.createdAt ?? new Date(0)
  const windowRows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), gt(messages.createdAt, since)))
    .orderBy(asc(messages.createdAt))

  if (windowRows.length < KEEP_RECENT + 4) return

  const toSummarize = windowRows.slice(0, windowRows.length - KEEP_RECENT)
  const prompt = buildSummaryPrompt(toSummarize)

  const result = await generateText({
    model: getModel(model || DEFAULT_MODEL),
    prompt,
  })

  const summaryText = result.text.trim()
  const cutoff = toSummarize[toSummarize.length - 1].id

  await db.transaction(async (tx) => {
    await tx.insert(messages).values({
      conversationId,
      role: "system",
      content: [{ type: "text", text: summaryText }] as unknown as object,
      isSummary: true,
      summarizesUntilMessageId: cutoff,
    })
    await tx
      .update(conversations)
      .set({
        compactionCount: sql`${conversations.compactionCount} + 1`,
        totalInputTokens: 0,
        totalOutputTokens: 0,
      })
      .where(eq(conversations.id, conversationId))
  })

  if (result.usage) {
    await recordUsage({
      userId,
      conversationId,
      model: model || DEFAULT_MODEL,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      eventKind: "compaction",
    })
  }

  await logAudit({
    userId,
    eventType: "compaction.executed",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: {
      messages_summarized: toSummarize.length,
      tokens_before: totalTokens,
    },
  })
}

function buildSummaryPrompt(
  rows: Array<{ role: string; content: unknown }>
): string {
  const transcript = rows
    .map((r) => {
      const text = extractText(r.content)
      return `${r.role.toUpperCase()}: ${text}`
    })
    .join("\n\n")

  return `Você é um compressor de histórico de chat. Resuma a conversa abaixo preservando:
- Decisões tomadas e seus porquês
- Fatos e dados que o usuário mencionou
- Tarefas em andamento
- Estado atual do raciocínio

Escreva em markdown com seções (Decisões, Fatos, Pendências). Máximo 500 tokens.

<conversation>
${transcript}
</conversation>`
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
