import { NextResponse, type NextRequest } from "next/server"
import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { conversations, messages } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { getModel } from "@/lib/ai/client"
import { DEFAULT_MODEL } from "@/lib/ai/pricing"
import { assertWithinCaps, QuotaError } from "@/lib/usage/caps"
import { recordUsage } from "@/lib/usage/counter"
import { logAudit } from "@/lib/audit/log"
import { estimateMessagesTokens } from "@/lib/ai/tokens"

export const maxDuration = 60

interface ChatRequestBody {
  conversationId: string
  messages: UIMessage[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await req.json()) as ChatRequestBody
  const { conversationId, messages: uiMessages } = body

  if (!conversationId || !Array.isArray(uiMessages)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 })
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)
  if (!conv || conv.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const model = conv.model || DEFAULT_MODEL
  const estimatedInput = estimateMessagesTokens(uiMessages)

  try {
    await assertWithinCaps(user.id, estimatedInput)
  } catch (err) {
    if (err instanceof QuotaError) {
      await logAudit({
        userId: user.id,
        eventType: "quota.exceeded",
        metadata: { scope: err.scope, used: err.used, cap: err.cap, estimated: estimatedInput },
      })
      return NextResponse.json(
        { error: "quota_exceeded", scope: err.scope, used: err.used, cap: err.cap },
        { status: 429 }
      )
    }
    throw err
  }

  const lastUser = uiMessages[uiMessages.length - 1]
  if (lastUser?.role === "user") {
    await db.insert(messages).values({
      conversationId,
      role: "user",
      content: lastUser.parts as unknown as object,
    })
    await logAudit({
      userId: user.id,
      eventType: "message.sent",
      resourceType: "conversation",
      resourceId: conversationId,
      metadata: {
        parts: lastUser.parts?.length ?? 0,
      },
    })
  }

  const modelMessages = await convertToModelMessages(uiMessages)
  const result = streamText({
    model: getModel(model),
    messages: modelMessages,
    onFinish: async ({ text, usage, finishReason }) => {
      const inputTokens = usage?.inputTokens ?? 0
      const outputTokens = usage?.outputTokens ?? 0

      const [inserted] = await db
        .insert(messages)
        .values({
          conversationId,
          role: "assistant",
          content: [{ type: "text", text }] as unknown as object,
          inputTokens,
          outputTokens,
          model,
        })
        .returning({ id: messages.id })

      await db
        .update(conversations)
        .set({
          updatedAt: new Date(),
          totalInputTokens: sql`${conversations.totalInputTokens} + ${inputTokens}`,
          totalOutputTokens: sql`${conversations.totalOutputTokens} + ${outputTokens}`,
        })
        .where(eq(conversations.id, conversationId))

      await recordUsage({
        userId: user.id,
        conversationId,
        messageId: inserted?.id,
        model,
        inputTokens,
        outputTokens,
        eventKind: "chat",
      })

      await logAudit({
        userId: user.id,
        eventType: "message.received",
        resourceType: "conversation",
        resourceId: conversationId,
        metadata: { inputTokens, outputTokens, model, finishReason },
      })
    },
  })

  return result.toUIMessageStreamResponse()
}
