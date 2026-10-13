"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, Share2, Loader2, Paperclip } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { MessageBubble } from "./message-bubble"
import { ShareDialog } from "./share-dialog"
import { AttachmentTiles } from "./attachment-tiles"
import { useAttachments } from "./use-attachments"
import { QuotaDialog } from "./quota-dialog"
import { ContextIndicator } from "./context-indicator"

const SUGGESTIONS = [
  "Me explica o que é RLS no PostgreSQL",
  "Quais foram as notícias de IA mais relevantes essa semana?",
  "Salva nas minhas notas: terminar o desafio técnico",
  "Que horas são agora em Lisboa?",
]

interface ChatViewProps {
  conversationId: string
  title: string
  compactionCount: number
  totalTokens: number
  initialMessages: UIMessage[]
}

export function ChatView({
  conversationId,
  title,
  compactionCount,
  totalTokens,
  initialMessages,
}: ChatViewProps) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [shareOpen, setShareOpen] = useState(false)
  const [quotaInfo, setQuotaInfo] = useState<{ scope: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const titledRef = useRef(initialMessages.length > 0)
  const attach = useAttachments(conversationId)

  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages, body }) {
        return {
          body: {
            conversationId,
            messages,
            attachments: (body as { attachments?: unknown })?.attachments ?? [],
          },
        }
      },
    }),
    onFinish: async ({ message }) => {
      if (!titledRef.current) {
        titledRef.current = true
        void generateTitle(message)
      }
      // atualiza totals pro ContextIndicator refletir o novo uso
      router.refresh()
    },
  })

  async function generateTitle(firstReply: UIMessage) {
    const text = firstReply.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ")
      .slice(0, 400)
    if (!text) return
    try {
      await fetch(`/api/conversations/${conversationId}/title`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hint: text }),
      })
      router.refresh()
    } catch {}
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text && attach.ready.length === 0) return
    if (attach.isUploading) {
      toast.info("Aguarde o upload terminar")
      return
    }
    setInput("")
    const attachmentsPayload = attach.ready.map((a) => ({
      storagePath: a.storagePath!,
      kind: a.kind,
      mimeType: a.mimeType,
      originalName: a.originalName,
      sizeBytes: a.sizeBytes,
    }))
    attach.reset()
    try {
      await sendMessage(
        { text: text || "(ver anexos)" },
        { body: { attachments: attachmentsPayload } }
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar"
      toast.error(msg)
    }
  }

  const isLoading = status === "submitted" || status === "streaming"

  useEffect(() => {
    if (error) {
      const anyErr = error as unknown as { message?: string }
      const msg = anyErr?.message ?? ""
      const lower = msg.toLowerCase()
      if (lower.includes("quota") || lower.includes("429")) {
        const scope = lower.includes("global") ? "global" : "user"
        setQuotaInfo({ scope })
      } else {
        toast.error(msg || "Erro na requisição")
      }
    }
  }, [error])

  return (
    <>
      <header className="border-b px-6 h-14 flex items-center justify-between gap-3 shrink-0">
        <h1 className="font-semibold truncate flex-1 min-w-0">{title}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <ContextIndicator
            conversationId={conversationId}
            initialTotalTokens={totalTokens}
            initialCompactionCount={compactionCount}
          />
          <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
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
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Pensando...
            </div>
          )}
        </div>
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
            >
              <Paperclip className="w-5 h-5" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem... (Shift+Enter para nova linha)"
              className="flex-1 resize-none min-h-[52px] max-h-48"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={(!input.trim() && attach.ready.length === 0) || isLoading}
              className="h-[52px] w-[52px] shrink-0"
            >
              <ArrowUp className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </form>

      <ShareDialog
        conversationId={conversationId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <QuotaDialog
        open={!!quotaInfo}
        scope={quotaInfo?.scope ?? "user"}
        onOpenChange={(open) => !open && setQuotaInfo(null)}
      />
    </>
  )
}
