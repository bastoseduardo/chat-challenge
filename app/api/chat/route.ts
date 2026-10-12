import { NextResponse, type NextRequest } from "next/server"
import { streamText, convertToModelMessages, type UIMessage, type ModelMessage } from "ai"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { conversations, messages, attachments as attachmentsTable, userSettings } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { getModel } from "@/lib/ai/client"
import { DEFAULT_MODEL } from "@/lib/ai/pricing"
import { assertWithinCaps, QuotaError } from "@/lib/usage/caps"
import { recordUsage } from "@/lib/usage/counter"
import { logAudit } from "@/lib/audit/log"
import { estimateMessagesTokens } from "@/lib/ai/tokens"
import { downloadAttachment } from "@/lib/storage/attachments"
import { getBuiltinTools, type BuiltinToolName } from "@/lib/ai/tools"
import { persistToolInvocations } from "@/lib/ai/tool-persist"
import { buildContext } from "@/lib/ai/history"
import { scheduleCompaction } from "@/lib/ai/compaction"

export const maxDuration = 60

interface AttachmentDescriptor {
  storagePath: string
  kind: "image" | "pdf"
  mimeType: string
  originalName: string
  sizeBytes: number
}

interface ChatRequestBody {
  conversationId: string
  messages: UIMessage[]
  attachments?: AttachmentDescriptor[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = (await req.json()) as ChatRequestBody
  const { conversationId, messages: uiMessages, attachments: incomingAttachments = [] } = body

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

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1)

  const enabledTools = (settings?.enabledTools ?? [
    "web_search",
    "web_scrape",
    "get_current_time",
  ]) as BuiltinToolName[]

  const model = conv.model || DEFAULT_MODEL
  const estimatedInput = estimateMessagesTokens(uiMessages) + incomingAttachments.length * 1500

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
  let userMessageId: string | null = null
  if (lastUser?.role === "user") {
    const [inserted] = await db
      .insert(messages)
      .values({
        conversationId,
        role: "user",
        content: lastUser.parts as unknown as object,
      })
      .returning({ id: messages.id })
    userMessageId = inserted?.id ?? null

    if (userMessageId && incomingAttachments.length > 0) {
      await db.insert(attachmentsTable).values(
        incomingAttachments.map((a) => ({
          messageId: userMessageId!,
          userId: user.id,
          storagePath: a.storagePath,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          originalName: a.originalName,
          kind: a.kind,
        }))
      )
      for (const a of incomingAttachments) {
        await logAudit({
          userId: user.id,
          eventType: "attachment.uploaded",
          resourceType: "attachment",
          metadata: { kind: a.kind, size_bytes: a.sizeBytes, mime_type: a.mimeType },
        })
      }
    }

    await logAudit({
      userId: user.id,
      eventType: "message.sent",
      resourceType: "conversation",
      resourceId: conversationId,
      metadata: {
        parts: lastUser.parts?.length ?? 0,
        attachments: incomingAttachments.length,
      },
    })
  }

  // Build the context from DB (persisted history, including compaction summary).
  const persistedContext = await buildContext(conversationId)

  // Inject attachment content into the latest user message of the model-side history.
  const attachmentParts = await Promise.all(
    incomingAttachments.map(async (a) => {
      const { data, mimeType } = await downloadAttachment(a.storagePath)
      const buf = Buffer.from(data)
      return {
        type: "file" as const,
        data: buf,
        mediaType: mimeType || a.mimeType,
        filename: a.originalName,
      }
    })
  )

  const modelMessages: ModelMessage[] = await convertToModelMessages(uiMessages)
  if (attachmentParts.length > 0 && modelMessages.length > 0) {
    const last = modelMessages[modelMessages.length - 1]
    if (last.role === "user") {
      const existingContent = Array.isArray(last.content)
        ? last.content
        : [{ type: "text", text: String(last.content) }]
      last.content = [...existingContent, ...attachmentParts] as typeof last.content
    }
  }

  // Replace with persisted context when available (keeps the system/summary message included).
  const historyMessages = persistedContext.length > 0 ? persistedContext : modelMessages

  const builtinTools = getBuiltinTools(enabledTools)

  const result = streamText({
    model: getModel(model),
    messages: historyMessages,
    tools: builtinTools,
    stopWhen: ({ steps }) => steps.length >= 5,
    onFinish: async ({ text, usage, finishReason, toolCalls, toolResults }) => {
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

      if (inserted?.id && (toolCalls || toolResults)) {
        await persistToolInvocations({
          userId: user.id,
          messageId: inserted.id,
          toolCalls: toolCalls ?? [],
          toolResults: toolResults ?? [],
        })
      }

      await logAudit({
        userId: user.id,
        eventType: "message.received",
        resourceType: "conversation",
        resourceId: conversationId,
        metadata: { inputTokens, outputTokens, model, finishReason },
      })

      scheduleCompaction({ conversationId, userId: user.id, model })
    },
  })

  return result.toUIMessageStreamResponse()
}
