/**
 * Estimador aproximado de tokens — chars / 4.
 * Para contagem exata usar o SDK da Anthropic no server quando disponível.
 */
export function estimateTokens(text: string | undefined | null): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

export function estimateMessagesTokens(
  messages: Array<{ content?: unknown; parts?: unknown }>
): number {
  let total = 0
  for (const m of messages) {
    const payload = m.parts ?? m.content
    if (typeof payload === "string") {
      total += estimateTokens(payload)
    } else if (Array.isArray(payload)) {
      for (const part of payload as Array<{ type?: string; text?: string }>) {
        if (part?.type === "text" && part.text) {
          total += estimateTokens(part.text)
        } else if (part?.type === "image" || part?.type === "file") {
          // conservative placeholder: 1500 tokens per media part
          total += 1500
        }
      }
    }
  }
  return total
}
