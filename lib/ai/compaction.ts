import { generateText, type UIMessage } from "ai"
import { textWithCitations } from "@/lib/sources/extract"
import { eq, and, gt, isNull, sql, asc } from "drizzle-orm"
import { after } from "next/server"
import { db } from "@/lib/db/client"
import { loadWindowStart } from "@/lib/ai/context-window"
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
  force?: boolean
}): Promise<{ compacted: boolean; reason?: string }> {
  const { conversationId, userId, model, force } = opts

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)
  if (!conv) return { compacted: false, reason: "conversation_not_found" }

  const totalTokens = conv.totalInputTokens + conv.totalOutputTokens
  const limit = ctxWindow(model)
  if (!force && totalTokens < threshold() * limit) {
    return { compacted: false, reason: "below_threshold" }
  }

  // Mensagens depois da última resumida (as recentes mantidas na compactação
  // anterior entram de novo; o resumo anterior vai junto no prompt).
  const { lastSummary, since } = await loadWindowStart(conversationId)
  const windowRows = await db
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

  const minToSummarize = force ? 2 : 4
  if (windowRows.length < KEEP_RECENT + minToSummarize) {
    return { compacted: false, reason: "not_enough_messages" }
  }

  const keepRecent = force ? Math.min(KEEP_RECENT, Math.max(2, windowRows.length - 2)) : KEEP_RECENT
  const toSummarize = windowRows.slice(0, windowRows.length - keepRecent)
  const prompt = buildSummaryPrompt(toSummarize, lastSummary ? extractText(lastSummary.content) : null)

  const result = await generateText({
    model: getModel(model || DEFAULT_MODEL),
    prompt,
  })

  const summaryText = result.text.trim()
  const cutoff = toSummarize[toSummarize.length - 1].id

  // Novo baseline: o summary + últimas N mensagens continuam no contexto após a compactação.
  // Estimamos tokens via chars/4 pra barra de contexto não mentir mostrando 0%.
  const summaryTokens = Math.ceil(summaryText.length / 4) + 50
  const recentRows = windowRows.slice(windowRows.length - keepRecent)
  const recentTokens = recentRows.reduce((acc, m) => {
    const text = extractText(m.content)
    return acc + Math.ceil(text.length / 4) + (m.inputTokens ?? 0) + (m.outputTokens ?? 0)
  }, 0)
  const newBaseline = summaryTokens + recentTokens

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
        totalInputTokens: newBaseline,
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
      forced: !!force,
    },
  })

  return { compacted: true }
}

function buildSummaryPrompt(
  rows: Array<{ role: string; content: unknown }>,
  previousSummary: string | null
): string {
  const transcript = rows
    .map((r) => {
      const text = Array.isArray(r.content)
        ? textWithCitations({ id: "", role: r.role, parts: r.content } as unknown as UIMessage)
        : extractText(r.content)
      return `${r.role.toUpperCase()}: ${text}`
    })
    .join("\n\n")

  return `Você é um compressor de histórico de chat. Resuma a conversa abaixo preservando:
- Decisões tomadas e seus porquês
- Fatos e dados que o usuário mencionou
- Tarefas em andamento
- Estado atual do raciocínio

Escreva em markdown com seções (Decisões, Fatos, Pendências). Máximo 500 tokens.
${previousSummary ? `
Já existe um resumo do trecho anterior; incorpore o que ainda importa dele, porque o novo resumo vai substituí-lo.

<previous_summary>
${previousSummary}
</previous_summary>
` : ""}
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
