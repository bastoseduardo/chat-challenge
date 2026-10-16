import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { shares } from "@/lib/db/schema"

/**
 * Apagar mensagens (editar e reenviar, "gerar de novo") invalida o resumo do
 * relatório compartilhado: ele foi escrito com o texto que saiu e aparece na
 * página pública e no og:description. Sem resumo, o relatório abre direto na
 * conversa; o dono gera de novo pelo diálogo de compartilhar.
 */
export async function invalidateShareSummary(conversationId: string) {
  await db
    .update(shares)
    .set({ summary: null, summaryGeneratedAt: null })
    .where(and(eq(shares.conversationId, conversationId), isNull(shares.revokedAt)))
}
