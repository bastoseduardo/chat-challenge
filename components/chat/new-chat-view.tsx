"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ArrowUp, Paperclip, Loader2 } from "lucide-react"
import { toast } from "sonner"

const SUGGESTIONS = [
  "Me explica o que é RLS no PostgreSQL",
  "Quais foram as notícias de IA mais relevantes essa semana?",
  "Salva nas minhas notas: terminar o desafio técnico",
  "Que horas são agora em Lisboa?",
]

export function NewChatView() {
  const router = useRouter()
  const [input, setInput] = useState("")
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      // Server cria conversa + persiste a 1ª mensagem user de uma vez só.
      // No destino, ChatView carrega essa msg no initialMessages e dispara
      // regenerate() pra pedir a resposta do modelo (sobrevive ao Strict Mode).
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ firstMessage: text }),
      })
      if (!res.ok) throw new Error("Falha ao criar conversa")
      const { conversation } = (await res.json()) as {
        conversation: { id: string }
      }
      router.push(`/c/${conversation.id}?autostart=1`)
      // Faz o layout RSC do /c revalidar e trazer a nova conversa pra sidebar.
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro inesperado")
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="border-b px-6 h-14 flex items-center shrink-0">
        <h1 className="font-semibold text-muted-foreground">Nova conversa</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Comece uma conversa</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              A conversa é criada quando você enviar a primeira mensagem — não
              antes.
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
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-[52px] w-[52px] shrink-0 cursor-not-allowed"
              onClick={() => toast.info("Envie uma mensagem primeiro para começar a conversa; depois você pode anexar arquivos.")}
              title="Anexos liberam após a primeira mensagem"
            >
              <Paperclip className="w-5 h-5 opacity-40" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua primeira mensagem..."
              className="flex-1 resize-none min-h-[52px] max-h-48"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
              disabled={submitting}
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || submitting}
              className="h-[52px] w-[52px] shrink-0"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </>
  )
}
