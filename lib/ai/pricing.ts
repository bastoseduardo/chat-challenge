/**
 * Modelos disponíveis + preços em USD por 1M tokens + context window.
 */
export interface ModelInfo {
  id: string
  label: string
  description: string
  input: number
  output: number
  ctx: number
}

export const MODELS: ModelInfo[] = [
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    description: "Balanceado · default · $3/$15 por 1M tokens",
    input: 3,
    output: 15,
    ctx: 200_000,
  },
  {
    id: "claude-opus-4-7",
    label: "Claude Opus 4.7",
    description: "Mais capaz · $15/$75 por 1M tokens (5× mais caro)",
    input: 15,
    output: 75,
    ctx: 200_000,
  },
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    description: "Mais rápido · $1/$5 por 1M tokens · ideal pra tarefas simples",
    input: 1,
    output: 5,
    ctx: 200_000,
  },
]

export const PRICING: Record<string, { input: number; output: number }> = Object.fromEntries(
  MODELS.map((m) => [m.id, { input: m.input, output: m.output }])
)

export const MODEL_CTX_WINDOW: Record<string, number> = Object.fromEntries(
  MODELS.map((m) => [m.id, m.ctx])
)

export const DEFAULT_MODEL = "claude-sonnet-4-6"

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? PRICING[DEFAULT_MODEL]
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

export function getModelInfo(id: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}
