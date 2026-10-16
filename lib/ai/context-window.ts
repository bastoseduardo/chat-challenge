import { and, desc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"

/**
 * Onde começa o histórico "vivo" depois de uma compactação: logo após a última
 * mensagem resumida (`summarizes_until_message_id`), e não na criação do
 * resumo. A compactação mantém as mensagens recentes fora do resumo; começar
 * pela data do resumo as deixava de fora do contexto do modelo.
 * Resumo antigo sem o corte registrado: cai na data do resumo.
 */
export function windowSince(summaryCreatedAt: Date | null, cutoffCreatedAt: Date | null): Date {
  if (!summaryCreatedAt) return new Date(0)
  return cutoffCreatedAt ?? summaryCreatedAt
}

/** Último resumo da conversa e a data a partir da qual vêm as mensagens. */
export async function loadWindowStart(conversationId: string) {
  const [lastSummary] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.isSummary, true), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt))
    .limit(1)

  let cutoffCreatedAt: Date | null = null
  if (lastSummary?.summarizesUntilMessageId) {
    const [cutoff] = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.id, lastSummary.summarizesUntilMessageId))
      .limit(1)
    cutoffCreatedAt = cutoff?.createdAt ?? null
  }

  return { lastSummary: lastSummary ?? null, since: windowSince(lastSummary?.createdAt ?? null, cutoffCreatedAt) }
}
