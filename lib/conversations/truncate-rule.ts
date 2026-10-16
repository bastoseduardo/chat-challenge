// Editar e reenviar (SPEC-R4-008): apaga a mensagem editada e todas as
// seguintes. Não vale pra trecho já resumido pela compactação: o resumo foi
// escrito a partir dessas mensagens e continuaria valendo no contexto.

export const TRUNCATE_BLOCKED_MESSAGE =
  "Essa parte da conversa já foi resumida e não pode ser editada."

/**
 * Bloqueia se a mensagem está dentro de algum resumo, isto é, se foi criada até
 * a última mensagem resumida (`summarizes_until_message_id`). As mensagens
 * recentes que a compactação manteve fora do resumo podem ser editadas.
 * `cutoffs`: data da mensagem de corte de cada resumo; resumo antigo sem corte
 * registrado entra com a data do próprio resumo (comportamento conservador).
 */
export function truncateBlocked(fromCreatedAt: Date, cutoffs: Date[]): boolean {
  return cutoffs.some((c) => fromCreatedAt.getTime() <= c.getTime())
}
