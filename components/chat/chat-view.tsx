"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useStickToBottom } from "use-stick-to-bottom"
import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowDown, Share2, Loader2, Download, MoreHorizontal, Upload } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AppHeader } from "@/components/app-header"
import { EditableTitle } from "./editable-title"
import { toast } from "sonner"
import { MessageBubble, toolStepOf } from "./message-bubble"
import { ShareDialog } from "./share-dialog"
import { useAttachments } from "./use-attachments"
import { Composer, type ComposerHandle } from "./composer"
import { EmptyState } from "./empty-state"
import { Welcome } from "@/components/onboarding/welcome"
import { TourPanel } from "@/components/onboarding/tour-panel"
import { SAMPLE_PROMPT } from "@/lib/demo/sample-prompt"
import { activityLabel } from "./research-trail"
import { QuotaDialog } from "./quota-dialog"
import { ContextIndicator } from "./context-indicator"
import { ConversationSettings } from "./conversation-settings"
import {
  COMPACTION_THRESHOLD,
  CONTEXT_WINDOW,
  NEW_CONVERSATION_TITLE,
  statsKey,
  succeeded,
  useConversationCache,
  useConversations,
  useConversationTitle,
  type ConversationStats,
} from "@/lib/conversations/store"
import { DEFAULT_MODEL } from "@/lib/ai/pricing"

interface ChatMetadata {
  usage?: { inputTokens: number; outputTokens: number }
}

// O transport do AI SDK lança Error com o corpo da resposta HTTP como message.
function isQuotaError(error: Error | undefined) {
  return !!error && error.message.includes("quota_exceeded")
}

function describeError(error: Error): string {
  const m = error.message.toLowerCase()
  if (m.includes("rate_limited")) {
    return "Muitas mensagens seguidas. Espere um minuto e tente de novo."
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Sem conexão com o servidor. Confira a internet e tente de novo."
  }
  return "A resposta não pôde ser gerada."
}

interface ChatViewProps {
  /** Ausente na tela de nova conversa: o id é gerado aqui e a linha no banco
   *  só é criada no primeiro envio (ou no primeiro anexo). */
  conversationId?: string
  title?: string
  compactionCount?: number
  totalTokens?: number
  model?: string
  systemPrompt?: string | null
  initialMessages?: UIMessage[]
  /** Força as boas-vindas (`/c/new?welcome=1`, só em dev). */
  forceWelcome?: boolean
}

export function ChatView({
  conversationId: existingId,
  title: initialTitle = NEW_CONVERSATION_TITLE,
  compactionCount = 0,
  totalTokens = 0,
  model = DEFAULT_MODEL,
  systemPrompt = null,
  initialMessages = [],
  forceWelcome = false,
}: ChatViewProps) {
  const queryClient = useQueryClient()
  const cache = useConversationCache()
  const [conversationId] = useState(() => existingId ?? crypto.randomUUID())
  // `started` = a conversa existe no banco e a URL já é /c/<id>.
  const [started, setStarted] = useState(!!existingId)
  const creatingRef = useRef<Promise<void> | null>(existingId ? Promise.resolve() : null)
  const title = useConversationTitle(conversationId, initialTitle)
  const { data: conversations } = useConversations()
  // Boas-vindas só pra quem ainda não tem nenhuma conversa (SPEC-R4-010).
  const [welcome] = useState(() => forceWelcome || (!existingId && conversations?.length === 0))

  const [input, setInput] = useState("")
  const [shareOpen, setShareOpen] = useState(false)
  const [quotaInfo, setQuotaInfo] = useState<{ scope: string } | null>(null)
  const composerRef = useRef<ComposerHandle>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  // Considera "já titulada" só se já existe resposta do assistant.
  const titledRef = useRef(initialMessages.some((m) => m.role === "assistant"))

  // Cria a linha da conversa uma única vez (envio e anexo podem chamar juntos).
  const ensureConversation = useCallback(async () => {
    if (!creatingRef.current) {
      creatingRef.current = fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: conversationId }),
      }).then((res) => {
        if (!succeeded(res)) throw new Error("Não foi possível criar a conversa. Tente de novo.")
      })
      creatingRef.current.catch(() => {
        creatingRef.current = null
      })
    }
    await creatingRef.current
  }, [conversationId])

  const attach = useAttachments(conversationId, ensureConversation)
  const { scrollRef, contentRef, isAtBottom, scrollToBottom, stopScroll } = useStickToBottom({
    initial: "instant",
    resize: "smooth",
  })

  // As boas-vindas são mais altas que a tela no celular: começam do topo, sem
  // o "grudar no fim" (o primeiro envio volta a grudar).
  useEffect(() => {
    if (!welcome || initialMessages.length > 0) return
    stopScroll()
    scrollRef.current?.scrollTo({ top: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Título da aba acompanha o da conversa (inclusive depois do replaceState
  // da nova conversa e de renomear), sem consultar o servidor.
  useEffect(() => {
    if (started) document.title = `${title} | Seshat`
  }, [started, title])

  // Resultado da busca (/c/<id>#msg-<id>): rola até a mensagem em vez do fim.
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith("#msg-")) return
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(hash.slice(1))
      if (!el) return
      stopScroll()
      el.scrollIntoView({ block: "start" })
    })
    return () => cancelAnimationFrame(frame)
  }, [stopScroll])

  const { messages, sendMessage, regenerate, stop, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, body }) {
        const lastMessage = messages[messages.length - 1]
        return {
          body: {
            conversationId,
            messages,
            attachments: (body as { attachments?: unknown })?.attachments ?? [],
            // id da última mensagem do user → idempotência server-side
            clientMessageId: lastMessage?.id,
          },
        }
      },
    }),
    // Cota estourada abre o diálogo; os demais erros aparecem inline, na
    // própria conversa, com "Tentar de novo".
    onError: (error) => {
      if (isQuotaError(error)) {
        setQuotaInfo({ scope: error.message.includes('"global"') ? "global" : "user" })
      }
    },
    onFinish: ({ message }) => {
      cache.touch(conversationId)
      const usage = (message.metadata as ChatMetadata | undefined)?.usage
      if (usage) {
        cache.addUsage(conversationId, usage.inputTokens + usage.outputTokens)
        checkCompactionLater()
      }
      if (!titledRef.current) {
        titledRef.current = true
        void generateTitle(message)
      }
    },
  })

  // A compactação roda em background no servidor depois da resposta. Só vale
  // conferir quando o uso está perto do limite; uma checagem basta.
  function checkCompactionLater() {
    const stats = queryClient.getQueryData<ConversationStats>(statsKey(conversationId))
    if (!stats) return
    const near = stats.totalTokens / CONTEXT_WINDOW >= COMPACTION_THRESHOLD * 0.75
    if (!near) return
    const before = stats.compactionCount
    setTimeout(async () => {
      await queryClient.refetchQueries({ queryKey: statsKey(conversationId) })
      const after = queryClient.getQueryData<ConversationStats>(statsKey(conversationId))
      if (after && after.compactionCount > before) {
        toast.success("Histórico comprimido pra manter o contexto")
      }
    }, 10_000)
  }

  async function generateTitle(firstReply: UIMessage) {
    const text = firstReply.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ")
      .slice(0, 400)
    if (!text) return
    try {
      const res = await fetch(`/api/conversations/${conversationId}/title`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hint: text }),
      })
      if (!succeeded(res)) return
      const data = (await res.json()) as { title?: string }
      if (data.title) cache.setTitle(conversationId, data.title)
    } catch {}
  }

  const handleRegenerate = useCallback(() => {
    void regenerate()
  }, [regenerate])

  // Primeiro envio numa conversa nova: cria a linha, troca a URL sem navegar
  // e coloca a conversa no topo da sidebar.
  async function startConversation() {
    if (started) return
    await ensureConversation()
    window.history.replaceState(null, "", `/c/${conversationId}`)
    cache.upsertTop({
      id: conversationId,
      title: NEW_CONVERSATION_TITLE,
      updatedAt: new Date().toISOString(),
    })
    setStarted(true)
  }

  async function handleSubmit(override?: string) {
    const text = (override ?? input).trim()
    if (!text && attach.ready.length === 0) return
    if (attach.isUploading) {
      toast.info("Aguarde o upload terminar")
      return
    }
    try {
      await startConversation()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar a conversa")
      return
    }
    setInput("")
    const readyAttachments = attach.ready
    const attachmentsPayload = readyAttachments.map((a) => ({
      storagePath: a.storagePath!,
      kind: a.kind,
      mimeType: a.mimeType,
      originalName: a.originalName,
      sizeBytes: a.sizeBytes,
    }))
    // Previews locais (blob URL) só pra renderizar na UI imediatamente —
    // o backend sanitiza e descarta esses file parts; o F5 reidrata via
    // listMessagesWithAttachments usando signed URLs do Storage.
    const previewFileParts = readyAttachments.map((a) => ({
      type: "file" as const,
      mediaType: a.mimeType,
      url: a.previewUrl ?? "",
      filename: a.originalName,
    }))
    attach.consume()
    void scrollToBottom()
    try {
      if (previewFileParts.length > 0) {
        await sendMessage(
          {
            parts: [
              ...previewFileParts,
              { type: "text", text: text || "(ver anexos)" },
            ],
          },
          { body: { attachments: attachmentsPayload } }
        )
      } else {
        await sendMessage(
          { text: text || "(ver anexos)" },
          { body: { attachments: attachmentsPayload } }
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar"
      toast.error(msg)
    }
  }

  const isLoading = status === "submitted" || status === "streaming"
  const last = messages[messages.length - 1]

  // Rótulo do que o assistente está fazendo agora, anunciado por leitores de
  // tela e exibido enquanto nenhuma parte da resposta chegou.
  const activity = useMemo(() => {
    if (!isLoading) return null
    if (!last || last.role === "user") return "Pensando…"
    // Só as notas do caderno chegaram (parte data-*): ainda pensando.
    if (last.parts.every((p) => p.type.startsWith("data-") || p.type === "step-start")) return "Pensando…"
    const parts = last.parts as Parameters<typeof toolStepOf>[0][]
    for (let i = parts.length - 1; i >= 0; i--) {
      const step = toolStepOf(parts[i], String(i))
      if (step && step.state !== "output-available" && step.state !== "output-error") {
        return activityLabel(step)
      }
    }
    return "Escrevendo a resposta…"
  }, [isLoading, last])

  const inlineError = error && !isQuotaError(error) ? describeError(error) : null

  function onDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return
    dragDepth.current += 1
    setDragging(true)
  }
  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    if (e.dataTransfer.files.length > 0) void attach.add(e.dataTransfer.files)
  }

  return (
    <>
      <AppHeader
        title={<EditableTitle conversationId={conversationId} title={title} editable={started} />}
      >
        {started && (
          <>
            <ContextIndicator
              conversationId={conversationId}
              initialTotalTokens={totalTokens}
              initialCompactionCount={compactionCount}
            />
            <ConversationSettings
              conversationId={conversationId}
              initialModel={model}
              initialSystemPrompt={systemPrompt}
            />
            <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
              <a
                href={`/api/conversations/${conversationId}/export?format=md`}
                download
                title="Exportar como Markdown"
                aria-label="Exportar como Markdown"
              >
                <Download className="size-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShareOpen(true)}
              className="hidden sm:inline-flex"
            >
              <Share2 className="size-4 mr-2" />
              Compartilhar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden pointer-coarse:size-11"
                  aria-label="Mais ações"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={`/api/conversations/${conversationId}/export?format=md`} download>
                    <Download className="mr-2 size-4" />
                    Exportar como Markdown
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShareOpen(true)}>
                  <Share2 className="mr-2 size-4" />
                  Compartilhar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </AppHeader>

      <div
        className="relative flex min-h-0 flex-1 flex-col"
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} className="h-full overflow-y-auto">
            <div ref={contentRef} className="mx-auto max-w-3xl space-y-7 px-4 py-6 sm:px-6">
              {messages.length === 0 && welcome && (
                <Welcome
                  onSample={() => void handleSubmit(SAMPLE_PROMPT)}
                  onPrompt={(text) => {
                    setInput(text)
                    composerRef.current?.focus()
                  }}
                  onPickFiles={() => composerRef.current?.pickFiles()}
                />
              )}
              {messages.length === 0 && !welcome && (
                <EmptyState
                  onPrompt={(text) => {
                    setInput(text)
                    composerRef.current?.focus()
                  }}
                  onPickFiles={() => composerRef.current?.pickFiles()}
                />
              )}
              {messages.map((m, idx) => {
                const isLast = idx === messages.length - 1
                return (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isLast={isLast}
                    isStreaming={isLast && isLoading && m.role === "assistant"}
                    onRegenerate={handleRegenerate}
                    conversationId={started ? conversationId : undefined}
                  />
                )
              })}
              {isLoading && activity === "Pensando…" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Pensando…
                </div>
              )}
              {inlineError && !isLoading && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm"
                >
                  <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />
                  <span className="flex-1">{inlineError}</span>
                  <Button size="sm" variant="outline" onClick={handleRegenerate}>
                    Tentar de novo
                  </Button>
                </div>
              )}
              <p className="sr-only" aria-live="polite">
                {activity ?? ""}
              </p>
            </div>
          </div>
          {!isAtBottom && messages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void scrollToBottom()}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card shadow-md"
            >
              <ArrowDown className="size-4 mr-1.5" />
              Ir para o fim
            </Button>
          )}
          {messages.length > 0 && <TourPanel />}
        </div>

        <Composer
          ref={composerRef}
          value={input}
          onChange={setInput}
          onSubmit={() => void handleSubmit()}
          onStop={() => void stop()}
          onFiles={(files) => void attach.add(files)}
          onRemoveAttachment={attach.remove}
          attachments={attach.items}
          canSend={!!input.trim() || attach.ready.length > 0}
          isLoading={isLoading}
          autoFocus={!existingId}
        />

        {dragging && (
          <div className="pointer-events-none absolute inset-2 z-10 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-background/85">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Upload className="size-4" aria-hidden />
              Solte para anexar imagens ou PDFs
            </div>
          </div>
        )}
      </div>

      {started && (
        <ShareDialog
          conversationId={conversationId}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}
      <QuotaDialog
        open={!!quotaInfo}
        scope={quotaInfo?.scope ?? "user"}
        onOpenChange={(open) => !open && setQuotaInfo(null)}
      />
    </>
  )
}
