"use client"

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react"
import { ArrowUp, Paperclip, Square } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AttachmentTiles } from "./attachment-tiles"
import type { PendingAttachment } from "./use-attachments"

const MAX_HEIGHT = 8 * 24 + 16 // 8 linhas de 24px + padding

export interface ComposerHandle {
  focus: () => void
  pickFiles: () => void
}

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  onFiles: (files: FileList | File[]) => void
  onRemoveAttachment: (id: string) => void
  attachments: PendingAttachment[]
  canSend: boolean
  isLoading: boolean
  autoFocus?: boolean
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  {
    value,
    onChange,
    onSubmit,
    onStop,
    onFiles,
    onRemoveAttachment,
    attachments,
    canSend,
    isLoading,
    autoFocus,
  },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    pickFiles: () => fileInputRef.current?.click(),
  }))

  // Cresce com o texto até 8 linhas; depois disso rola por dentro.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden"
  }, [value])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!isLoading) onSubmit()
      }}
      className="shrink-0 px-3 pb-3 pt-1 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto max-w-3xl rounded-lg border bg-card shadow-lg shadow-black/10 transition-colors focus-within:border-ring">
        <AttachmentTiles items={attachments} onRemove={onRemoveAttachment} />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFiles(e.target.files)
            e.target.value = ""
          }}
        />
        <label htmlFor="composer-input" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          value={value}
          rows={1}
          autoFocus={autoFocus}
          placeholder="Pergunte algo ou solte um PDF aqui"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (!isLoading) onSubmit()
            }
            if (e.key === "Escape" && isLoading) {
              e.preventDefault()
              onStop()
            }
          }}
          onPaste={(e) => {
            const imgs = Array.from(e.clipboardData.files).filter((f) =>
              f.type.startsWith("image/")
            )
            if (imgs.length > 0) {
              e.preventDefault()
              onFiles(imgs)
              toast.success(imgs.length === 1 ? "Imagem colada" : `${imgs.length} imagens coladas`)
            }
          }}
          className="block w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base leading-6 placeholder:text-muted-foreground focus-visible:outline-none sm:text-[15px]"
        />
        <div className="flex items-center gap-2 px-2 pb-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Anexar imagem ou PDF"
            title="Anexar imagem ou PDF"
            className="text-muted-foreground pointer-coarse:size-11"
          >
            <Paperclip className="size-[18px]" />
          </Button>
          <p className="flex-1 truncate text-xs text-muted-foreground">
            <span className="hidden sm:inline">
              {isLoading
                ? "Esc interrompe a resposta"
                : "Enter envia, Shift+Enter quebra a linha, Ctrl+V cola imagens"}
            </span>
          </p>
          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={onStop}
              aria-label="Parar a resposta"
              title="Parar a resposta (Esc)"
              className="pointer-coarse:size-11"
            >
              <Square className="size-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!canSend}
              aria-label="Enviar mensagem"
              title="Enviar (Enter)"
              className="pointer-coarse:size-11"
            >
              <ArrowUp className="size-[18px]" />
            </Button>
          )}
        </div>
      </div>
    </form>
  )
})
