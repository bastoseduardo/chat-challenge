"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const MAX_HEIGHT = 320

/**
 * Edição inline de uma pergunta (SPEC-R4-008). Enter envia, Shift+Enter quebra
 * a linha e Esc cancela, como no composer.
 */
export function EditUserMessage({
  initialText,
  hasFiles,
  onCancel,
  onSubmit,
}: {
  initialText: string
  hasFiles: boolean
  onCancel: () => void
  onSubmit: (text: string) => Promise<boolean>
}) {
  const [text, setText] = useState(initialText)
  const [sending, setSending] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden"
  }, [text])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const canSend = !!text.trim() && text.trim() !== initialText.trim() && !sending

  async function submit() {
    if (!canSend) return
    setSending(true)
    const ok = await onSubmit(text.trim())
    if (!ok) setSending(false)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="w-full max-w-[85%] space-y-2 rounded-lg border border-ring bg-card p-3 sm:max-w-[75%]"
    >
      <label htmlFor="edit-message" className="sr-only">
        Editar pergunta
      </label>
      <textarea
        id="edit-message"
        ref={ref}
        value={text}
        rows={1}
        disabled={sending}
        aria-describedby="edit-message-help"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            onCancel()
          } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            void submit()
          }
        }}
        className="block w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none"
      />
      <p id="edit-message-help" className="text-xs text-muted-foreground">
        Ao enviar, o que veio depois desta pergunta é apagado e a resposta é gerada de novo.
        {hasFiles && " Os anexos desta mensagem não são reenviados."}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={sending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={!canSend}>
          {sending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Enviar
        </Button>
      </div>
    </form>
  )
}
