"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowUp, Share2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { MessageBubble } from "./message-bubble"
import { ShareDialog } from "./share-dialog"

interface ChatViewProps {
  conversationId: string
  title: string
  compactionCount: number
  initialMessages: UIMessage[]
}

export function ChatView({
  conversationId,
  title,
  compactionCount,
  initialMessages,
}: ChatViewProps) {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [shareOpen, setShareOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const titledRef = useRef(initialMessages.length > 0)

  const { messages, sendMessage, status, error } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages }) {
        return { body: { conversationId, messages } }
      },
    }),
    onFinish: async ({ message }) => {
      if (!titledRef.current) {
        titledRef.current = true
        void generateTitle(message)
      }
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
    if (!text) return
    setInput("")
    try {
      await sendMessage({ text })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar"
      toast.error(msg)
    }
  }

  const isLoading = status === "submitted" || status === "streaming"

  useEffect(() => {
    if (error) {
      const anyErr = error as unknown as { message?: string; status?: number }
      if (anyErr?.message?.toLowerCase().includes("quota")) {
        toast.error("Limite diário de tokens atingido.")
      } else {
        toast.error(anyErr?.message ?? "Erro na requisição")
      }
    }
  }, [error])

  return (
    <>
      <header className="border-b px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="font-semibold truncate">{title}</h1>
          {compactionCount > 0 && (
            <Badge variant="secondary" title="Histórico comprimido">
              Comprimido {compactionCount}x
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>
          <Share2 className="w-4 h-4 mr-2" />
          Compartilhar
        </Button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-16">
              <p className="text-lg">Comece uma conversa</p>
              <p className="text-sm mt-2">
                Envie mensagens, anexos (imagens/PDF) e use tools de web search.
              </p>
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
        <div className="max-w-3xl mx-auto flex gap-2">
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
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="h-[52px] w-[52px] shrink-0">
            <ArrowUp className="w-5 h-5" />
          </Button>
        </div>
      </form>

      <ShareDialog
        conversationId={conversationId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  )
}
