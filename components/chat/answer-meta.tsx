import type { UIMessage } from "ai"
import { MODELS } from "@/lib/ai/pricing"

/** "Sonnet 4.6": qual modelo escreveu a resposta (SPEC-R4-009). */
export function modelLabel(id: string): string {
  const info = MODELS.find((m) => m.id === id)
  return info ? info.label.replace(/^Claude\s+/, "") : id
}

/** Rodapé da resposta: modelo e linha de confiança das fontes, separados por "·". */
export function AnswerMeta({ message, trust }: { message: UIMessage; trust?: string | null }) {
  const model = (message.metadata as { model?: string } | undefined)?.model
  const items = [model && modelLabel(model), trust].filter(Boolean)
  if (items.length === 0) return null
  return <span className="ml-1.5 text-xs text-muted-foreground">{items.join(" · ")}</span>
}
