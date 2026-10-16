// Editar e reenviar (SPEC-R4-008): apaga a mensagem editada e todas as
// seguintes. Não vale pra trecho já resumido pela compactação: o resumo foi
// escrito a partir das mensagens antigas e continuaria valendo no contexto.

export const TRUNCATE_BLOCKED_MESSAGE =
  "Essa parte da conversa já foi resumida e não pode ser editada."

/** Bloqueia se algum resumo foi criado depois da mensagem a editar. */
export function truncateBlocked(fromCreatedAt: Date, summariesCreatedAt: Date[]): boolean {
  return summariesCreatedAt.some((s) => s.getTime() > fromCreatedAt.getTime())
}
