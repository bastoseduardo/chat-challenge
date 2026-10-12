import { createServiceClient } from "@/lib/supabase/service"
import { costUsd } from "@/lib/ai/pricing"

export type UsageEventKind = "chat" | "compaction" | "tool_llm"

export interface RecordUsageInput {
  userId: string
  conversationId?: string
  messageId?: string
  model: string
  inputTokens: number
  outputTokens: number
  eventKind: UsageEventKind
}

export async function recordUsage(input: RecordUsageInput): Promise<void> {
  const supabase = createServiceClient()
  const cost = costUsd(input.model, input.inputTokens, input.outputTokens)
  const { error } = await supabase.from("usage_events").insert({
    user_id: input.userId,
    conversation_id: input.conversationId ?? null,
    message_id: input.messageId ?? null,
    model: input.model,
    input_tokens: input.inputTokens,
    output_tokens: input.outputTokens,
    cost_usd: cost.toFixed(6),
    event_kind: input.eventKind,
  })
  if (error) console.error("[usage] insert failed:", error.message)
}

export async function sumTokensToday(
  userId: string | null
): Promise<{ input: number; output: number; cost: number }> {
  const supabase = createServiceClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let query = supabase
    .from("usage_events")
    .select("input_tokens, output_tokens, cost_usd")
    .gte("created_at", today.toISOString())
  if (userId) query = query.eq("user_id", userId)
  const { data, error } = await query
  if (error || !data) return { input: 0, output: 0, cost: 0 }
  return data.reduce(
    (acc, r) => ({
      input: acc.input + (r.input_tokens ?? 0),
      output: acc.output + (r.output_tokens ?? 0),
      cost: acc.cost + Number(r.cost_usd ?? 0),
    }),
    { input: 0, output: 0, cost: 0 }
  )
}
