/**
 * Preços em USD por 1M tokens. Atualizar com valores oficiais da Anthropic.
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-7": { input: 15, output: 75 },
}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"]
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

export const DEFAULT_MODEL = "claude-sonnet-4-6"

export const MODEL_CTX_WINDOW: Record<string, number> = {
  "claude-sonnet-4-6": 200_000,
  "claude-opus-4-7": 200_000,
}
