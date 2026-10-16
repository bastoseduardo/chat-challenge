import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"

/**
 * Onde começa o histórico "vivo" depois de uma compactação: logo após a última
 * mensagem resumida (`summarizes_until_message_id`), e não na criação do
 * resumo. A compactação mantém as mensagens recentes fora do resumo; começar
 * pela data do resumo as deixava de fora do contexto do modelo.
 * Resumo antigo sem o corte registrado: cai na data do resumo. `null` = desde
 * o começo.
 */
export function windowSince<T>(summaryCreatedAt: T | null, cutoffCreatedAt: T | null): T | null {
  if (summaryCreatedAt === null) return null
  return cutoffCreatedAt ?? summaryCreatedAt
}

/**
 * Último resumo da conversa e o filtro "depois do início da janela". As datas
 * vêm como texto do Postgres (microssegundos): um Date do JS trunca em
 * milissegundos e a própria mensagem de corte passaria no `>`.
 */
export async function loadWindowStart(conversationId: string): Promise<{
  lastSummary: typeof messages.$inferSelect | null
  afterStart: SQL | undefined
}> {
  const [row] = await db
    .select({ summary: messages, createdAtText: sql<string>`${messages.createdAt}::text` })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), eq(messages.isSummary, true), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt))
    .limit(1)

  let cutoffText: string | null = null
  if (row?.summary.summarizesUntilMessageId) {
    const [cutoff] = await db
      .select({ createdAtText: sql<string>`${messages.createdAt}::text` })
      .from(messages)
      .where(eq(messages.id, row.summary.summarizesUntilMessageId))
      .limit(1)
    cutoffText = cutoff?.createdAtText ?? null
  }

  const since = windowSince(row?.createdAtText ?? null, cutoffText)
  return {
    lastSummary: row?.summary ?? null,
    afterStart: since ? sql`${messages.createdAt} > ${since}::timestamptz` : undefined,
  }
}
