"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useStickToBottom } from "use-stick-to-bottom"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, ArrowDown, Share2, Loader2, Paperclip, Download, Square } from "lucide-react"
import { toast } from "sonner"
import { MessageBubble } from "./message-bubble"
import { ShareDialog } from "./share-dialog"
import { AttachmentTiles } from "./attachment-tiles"
import { useAttachments } from "./use-attachments"
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
  useConversationTitle,
  type ConversationStats,
} from "@/lib/conversations/store"
import { DEFAULT_MODEL } from "@/lib/ai/pricing"

const SUGGESTIONS = [
  "Me explica o que é RLS no PostgreSQL",
  "Quais foram as notícias de IA mais relevantes essa semana?",
  "Salva nas minhas notas: terminar o desafio técnico",
  "Que horas são agora em Lisboa?",
]

interface ChatMetadata {
  usage?: { inputTokens: number; outputTokens: number }
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
}

export function ChatView({
  conversationId: existingId,
  title: initialTitle = NEW_CONVERSATION_TITLE,
  compactionCount = 0,
  totalTokens = 0,
  model = DEFAULT_MODEL,
  systemPrompt = null,
  initialMessages = [],
}: ChatViewProps) {
  const queryClient = useQueryClient()
  const cache = useConversationCache()
  const [conversationId] = useState(() => existingId ?? crypto.randomUUID())
  // `started` = a conversa existe no banco e a URL já é /c/<id>.
  const [started, setStarted] = useState(!!existingId)
  const creatingRef = useRef<Promise<void> | null>(existingId ? Promise.resolve() : null)
  const title = useConversationTitle(conversationId, initialTitle)

  const [input, setInput] = useState("")
  const [shareOpen, setShareOpen] = useState(false)
  const [quotaInfo, setQuotaInfo] = useState<{ scope: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const { scrollRef, contentRef, isAtBottom, scrollToBottom } = useStickToBottom({
    initial: "instant",
    resize: "smooth",
  })

  const { messages, sendMessage, regenerate, stop, status } = useChat({
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
    onError: (error) => {
      const msg = error?.message ?? ""
      const lower = msg.toLowerCase()
      if (lower.includes("quota") || lower.includes("429")) {
        const scope = lower.includes("global") ? "global" : "user"
        setQuotaInfo({ scope })
      } else {
        toast.error(msg || "Erro na requisição")
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
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

  return (
    <>
      <header className="border-b px-4 sm:px-6 h-14 flex items-center justify-between gap-2 shrink-0">
        <h1
          title={title}
          className="font-semibold truncate flex-1 min-w-0 whitespace-nowrap"
        >
          {title}
        </h1>
        {started && (
          <div className="flex items-center gap-1 shrink-0">
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
            <Button variant="ghost" size="icon" asChild>
              <a
                href={`/api/conversations/${conversationId}/export?format=md`}
                download
                title="Exportar como Markdown"
                aria-label="Exportar como Markdown"
              >
                <Download className="w-4 h-4" />
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Compartilhar</span>
            </Button>
          </div>
        )}
      </header>

      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div ref={contentRef} className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.length === 0 && (
              <div className="py-10 space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2">Comece uma conversa</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Envie mensagens, anexe imagens ou PDFs, e use tools como web search e MCP.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="text-left px-3 py-2 rounded-lg border bg-card hover:bg-accent text-sm transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, idx) => (
              <MessageBubble
                key={m.id}
                message={m}
                isLast={idx === messages.length - 1}
                onRegenerate={handleRegenerate}
              />
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                role="status"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                Pensando...
              </div>
            )}
          </div>
        </div>
        {!isAtBottom && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void scrollToBottom()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md bg-card"
          >
            <ArrowDown className="w-4 h-4 mr-1.5" />
            Ir para o fim
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <AttachmentTiles items={attach.items} onRemove={attach.remove} />
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void attach.add(e.target.files)
                e.target.value = ""
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-[52px] w-[52px] shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Anexar imagem ou PDF"
              title="Anexar imagem ou PDF"
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files)
                const imgs = files.filter((f) => f.type.startsWith("image/"))
                if (imgs.length > 0) {
                  e.preventDefault()
                  const dt = new DataTransfer()
                  imgs.forEach((f) => dt.items.add(f))
                  void attach.add(dt.files)
                  toast.success(
                    imgs.length === 1 ? "Imagem colada" : `${imgs.length} imagens coladas`
                  )
                }
              }}
              placeholder="Digite sua mensagem... (Shift+Enter nova linha, Ctrl+V cola imagem)"
              className="flex-1 resize-none min-h-[52px] max-h-48"
              rows={1}
              autoFocus={!existingId}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              disabled={isLoading}
            />
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={() => stop()}
                className="h-[52px] w-[52px] shrink-0"
                title="Parar geração"
                aria-label="Parar geração"
              >
                <Square className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() && attach.ready.length === 0}
                className="h-[52px] w-[52px] shrink-0"
                aria-label="Enviar mensagem"
              >
                <ArrowUp className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </form>

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
