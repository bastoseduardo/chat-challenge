import { NextResponse, type NextRequest } from "next/server"
import { after } from "next/server"
import { createUIMessageStream, createUIMessageStreamResponse, streamText, type UIMessage } from "ai"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { conversations, messages, attachments as attachmentsTable, userSettings } from "@/lib/db/schema"
import { and, eq, gt, isNull, sql } from "drizzle-orm"
import { getModel } from "@/lib/ai/client"
import { DEFAULT_MODEL } from "@/lib/ai/pricing"
import { assertWithinCaps, QuotaError } from "@/lib/usage/caps"
import { recordUsage } from "@/lib/usage/counter"
import { logAudit } from "@/lib/audit/log"
import { estimateMessagesTokens } from "@/lib/ai/tokens"
import { getBuiltinTools, type BuiltinToolName } from "@/lib/ai/tools"
import { persistToolInvocations } from "@/lib/ai/tool-persist"
import { buildContext } from "@/lib/ai/history"
import { scheduleCompaction } from "@/lib/ai/compaction"
import { loadMcpTools, closeMcpClients } from "@/lib/ai/mcp"
import { assertRateLimit, RateLimitError, getClientIp } from "@/lib/rate-limit"
import { embedAndStoreMessage } from "@/lib/db/queries/search"
import { compactPartsForStorage } from "@/lib/ai/persist-parts"
import { findContextNotes, notesUsedData, withNotesContext } from "@/lib/notes/context"

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
  clientMessageId?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const ip = getClientIp(req)
  try {
    await assertRateLimit({ key: `chat:${ip}`, limit: 10, windowMs: 60_000 })
  } catch (err) {
    if (err instanceof RateLimitError) {
      await logAudit({
        userId: user.id,
        eventType: "quota.exceeded",
        metadata: { scope: "ip_rate_limit", endpoint: "chat", ip },
      })
      return NextResponse.json(
        { error: "rate_limited", retryAfter: err.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSec) } }
      )
    }
    throw err
  }

  const body = (await req.json()) as ChatRequestBody
  const {
    conversationId,
    messages: uiMessages,
    attachments: incomingAttachments = [],
    clientMessageId,
  } = body

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

  // Pega o provider_token do Google OAuth pra Drive (se o scope foi concedido)
  const { data: { session } } = await supabase.auth.getSession()
  const driveToken = session?.provider_token ?? null

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
  const userText =
    lastUser?.role === "user"
      ? (lastUser.parts ?? [])
          .filter((p): p is { type: "text"; text: string } => (p as { type?: string }).type === "text")
          .map((p) => p.text)
          .join("\n")
          .trim()
      : ""
  // Caderno como contexto (SPEC-R4-006): roda junto com o resto da preparação.
  const notesPromise =
    userText && settings?.useNotesContext !== false
      ? findContextNotes(user.id, userText)
      : Promise.resolve([])

  let userMessageId: string | null = null
  let isDuplicate = false
  if (lastUser?.role === "user") {
    // Sanitiza: remove file parts com URL blob (preview local do cliente).
    // Attachments reais chegam via `attachments` body e vão pra tabela
    // própria; buildContext reidrata com signed URLs do Storage.
    const sanitizedParts = (lastUser.parts as Array<{ type?: string; url?: unknown }>).filter(
      (p) => {
        if (p?.type !== "file") return true
        const url = typeof p.url === "string" ? p.url : ""
        return !url.startsWith("blob:")
      }
    )
    // Idempotência: se o cliente mandou clientMessageId e esse par já existe, só pega o id.
    const [inserted] = await db
      .insert(messages)
      .values({
        conversationId,
        clientMessageId: clientMessageId ?? null,
        role: "user",
        content: sanitizedParts as unknown as object,
      })
      .onConflictDoNothing({
        target: [messages.conversationId, messages.clientMessageId],
      })
      .returning({ id: messages.id })

    if (inserted) {
      userMessageId = inserted.id
    } else if (clientMessageId) {
      isDuplicate = true
      const [existing] = await db
        .select({ id: messages.id, createdAt: messages.createdAt })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.clientMessageId, clientMessageId)
          )
        )
        .limit(1)
      userMessageId = existing?.id ?? null
      // "Gerar de novo" reenvia a mesma pergunta: a resposta anterior sai do
      // histórico (soft delete), senão as duas voltariam ao recarregar.
      if (existing) {
        await db
          .update(messages)
          .set({ deletedAt: new Date() })
          .where(
            and(
              eq(messages.conversationId, conversationId),
              gt(messages.createdAt, existing.createdAt),
              eq(messages.isSummary, false),
              isNull(messages.deletedAt)
            )
          )
      }
    }

    if (userMessageId && !isDuplicate && incomingAttachments.length > 0) {
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

    // Embedding em background (não bloqueia stream).
    if (userMessageId && !isDuplicate && userText) {
      after(() => embedAndStoreMessage(userMessageId!, userText))
    }
  }

  // Build context from DB — já inclui summary de compactação e anexos como signed URLs.
  // (Attachments entram via buildContext como file parts com URL, não bytes.)
  const [history, mcp, contextNotes] = await Promise.all([
    buildContext(conversationId),
    loadMcpTools({ userId: user.id, mcpConfig: settings?.mcpConfig }),
    notesPromise,
  ])

  if (lastUser?.role === "user") {
    await logAudit({
      userId: user.id,
      eventType: "message.sent",
      resourceType: "conversation",
      resourceId: conversationId,
      metadata: {
        parts: lastUser.parts?.length ?? 0,
        attachments: incomingAttachments.length,
        notes_used: contextNotes.length,
      },
    })
  }

  const builtinTools = getBuiltinTools({ enabled: enabledTools, driveToken })
  const allTools = { ...builtinTools, ...mcp.tools }

  // Prompt mínimo pra garantir que, após tool calls, o modelo sempre escreva
  // uma resposta final em texto pro usuário (evita conversas que terminam só
  // com tool_calls e sem text).
  const BASE_SYSTEM = `You can call tools to gather info. ALWAYS end your turn with a plain-text reply to the user summarizing what you found; never stop mid-tool-chain without a response.

When you use web search, web fetch or attached documents, ground factual claims in those sources; citations are attached to your text automatically, so do not write your own reference markers or source lists. Prefer the search results; fetch a page only when the snippets are not enough. If part of the answer comes only from your own knowledge, say so briefly.`
  const userSystem = conv.systemPrompt?.trim()
  // Resumo da compactação no fim do system: muda só quando há nova
  // compactação, então o prefixo cacheado continua valendo entre turnos.
  const combinedSystem = [
    BASE_SYSTEM,
    userSystem,
    history.summary &&
      `Resumo do histórico anterior desta conversa (gerado pela compactação automática):\n\n${history.summary}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  // Id da resposta gerado aqui: é o mesmo no cliente (generateMessageId do
  // stream) e em messages.id. Duas callbacks gravam a mesma linha via upsert:
  // onFinish (tokens, uso, ferramentas) e onEnd (parts completas, inclusive
  // citações). A ordem entre elas não importa; resposta interrompida também
  // fica salva pelo onEnd.
  const assistantMessageId = crypto.randomUUID()

  const result = streamText({
    model: getModel(model),
    system: combinedSystem,
    messages: withNotesContext(history.messages, contextNotes),
    tools: allTools,
    // 10 steps dá folga pra 4-5 tool calls + resposta final. 5 era agressivo
    // demais e deixava conversas presas em "research mode" sem texto.
    stopWhen: ({ steps }) => steps.length >= 10,
    onFinish: async ({ text, usage, finishReason, toolCalls, toolResults }) => {
      const inputTokens = usage?.inputTokens ?? 0
      const outputTokens = usage?.outputTokens ?? 0

      const [inserted] = await db
        .insert(messages)
        .values({
          id: assistantMessageId,
          conversationId,
          role: "assistant",
          // Provisório: o onEnd grava as parts completas (se chegar antes, o
          // conflito abaixo preserva o content dele).
          content: [{ type: "text", text }] as unknown as object,
          inputTokens,
          outputTokens,
          model,
        })
        .onConflictDoUpdate({
          target: messages.id,
          set: { inputTokens, outputTokens, model },
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
          mcpToolNames: new Set(Object.keys(mcp.tools)),
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

      // Embedding da resposta em background (não bloqueia o cliente).
      if (inserted?.id && text?.trim()) {
        after(() => embedAndStoreMessage(inserted.id, text))
      }

      scheduleCompaction({ conversationId, userId: user.id, model })
      await closeMcpClients(mcp.clients)
    },
  })

  // O uso agregado vai no metadata da mensagem (evento `finish`) — o cliente
  // atualiza o indicador de contexto sem refresh nem polling. É o mesmo valor
  // gravado em conversations.total_*_tokens no onFinish acima.
  // As notas usadas vão antes da resposta como parte `data-notes-used`; o onEnd
  // do stream externo vê todas as partes (inclusive essa) e grava a resposta.
  const stream = createUIMessageStream({
    originalMessages: uiMessages,
    generateId: () => assistantMessageId,
    execute: ({ writer }) => {
      if (contextNotes.length > 0) {
        writer.write({ type: "data-notes-used", data: notesUsedData(contextNotes) })
      }
      writer.merge(
        result.toUIMessageStream({
          sendSources: true,
          generateMessageId: () => assistantMessageId,
          messageMetadata: ({ part }) => {
            // Modelo no início (rodapé da resposta, SPEC-R4-009); uso no fim.
            if (part.type === "start") return { model }
            if (part.type !== "finish") return undefined
            return {
              usage: {
                inputTokens: part.totalUsage.inputTokens ?? 0,
                outputTokens: part.totalUsage.outputTokens ?? 0,
              },
            }
          },
        })
      )
    },
    onEnd: async ({ responseMessage, isAborted }) => {
      if (responseMessage.role !== "assistant" || responseMessage.parts.length === 0) return
      const content = compactPartsForStorage(responseMessage.parts) as unknown as object
      try {
        await db
          .insert(messages)
          .values({ id: assistantMessageId, conversationId, role: "assistant", content, model })
          .onConflictDoUpdate({ target: messages.id, set: { content } })
      } catch (err) {
        console.error("[chat] falha ao salvar parts da resposta", { isAborted, err })
      }
    },
  })

  return createUIMessageStreamResponse({ stream })
}
