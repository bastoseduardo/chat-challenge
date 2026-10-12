import { NextResponse, type NextRequest } from "next/server"
import { generateText } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getConversation, renameConversation } from "@/lib/db/queries/conversations"
import { getModel } from "@/lib/ai/client"
import { recordUsage } from "@/lib/usage/counter"
import { DEFAULT_MODEL } from "@/lib/ai/pricing"

const bodySchema = z.object({ hint: z.string().min(1).max(2000) })

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const conv = await getConversation(id, user.id)
  if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 })
  if (conv.title !== "Nova conversa") {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const result = await generateText({
    model: getModel(DEFAULT_MODEL),
    prompt: `Gere um título curto (3-6 palavras, sem aspas, sem pontuação final) para esta conversa:\n\n${parsed.data.hint}\n\nTítulo:`,
  })

  const title = result.text.trim().replace(/^["']|["']$/g, "").slice(0, 60)
  if (title) await renameConversation(id, user.id, title)

  const usage = result.usage
  if (usage) {
    await recordUsage({
      userId: user.id,
      conversationId: id,
      model: DEFAULT_MODEL,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      eventKind: "tool_llm",
    })
  }

  return NextResponse.json({ ok: true, title })
}
