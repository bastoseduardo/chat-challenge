"use client"

import type { UIMessage } from "ai"
import { memo, useState, type ReactNode } from "react"
import { Copy, RefreshCw, Check, FileText } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"
import { ResearchTrail, type ToolStep } from "./research-trail"
import { ImageLightbox } from "./image-lightbox"

interface MessageBubbleProps {
  message: UIMessage
  isLast?: boolean
  /** Última mensagem enquanto o modelo ainda escreve. */
  isStreaming?: boolean
  onRegenerate?: () => void
}

type AnyPart = UIMessage["parts"][number] & {
  toolName?: string
  toolCallId?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

export function toolStepOf(part: AnyPart, key: string): ToolStep | null {
  if (part.type === "dynamic-tool") {
    return { key, toolName: part.toolName ?? "tool", ...pick(part) }
  }
  if (part.type?.startsWith("tool-")) {
    return { key, toolName: part.type.slice("tool-".length), ...pick(part) }
  }
  return null
}

function pick(part: AnyPart) {
  return { state: part.state, input: part.input, output: part.output, errorText: part.errorText }
}

function extractText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
}

function FilePart({ part }: { part: AnyPart & { url?: unknown; mediaType?: string; filename?: string } }) {
  const url = typeof part.url === "string" ? part.url : null
  if (!url) return null
  const name = part.filename ?? "Arquivo"
  if (part.mediaType?.startsWith("image/")) {
    return <ImageLightbox src={url} alt={part.filename ?? ""} />
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-sm hover:bg-accent transition-colors"
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{name}</span>
    </a>
  )
}

function UserMessage({ message }: { message: UIMessage }) {
  const parts = message.parts as AnyPart[]
  const files = parts.filter((p) => p.type === "file")
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] space-y-2 rounded-lg border bg-card px-4 py-2.5 sm:max-w-[75%]">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((p, i) => (
              <FilePart key={i} part={p} />
            ))}
          </div>
        )}
        {parts.map((p, i) =>
          p.type === "text" ? <Markdown key={i} text={(p as { text: string }).text} /> : null
        )}
      </div>
    </div>
  )
}

function AssistantMessage({ message, isLast, isStreaming, onRegenerate }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const parts = message.parts as AnyPart[]

  // Agrupa chamadas de ferramenta consecutivas numa única trilha, mantendo a
  // ordem real em relação ao texto (multi-step: busca → texto → nova busca).
  const blocks: ReactNode[] = []
  let pending: ToolStep[] = []
  const flush = (i: number) => {
    if (pending.length === 0) return
    const isTail = i === parts.length
    blocks.push(<ResearchTrail key={`trail-${i}`} steps={pending} live={isStreaming && isTail} />)
    pending = []
  }
  parts.forEach((p, i) => {
    const step = toolStepOf(p, p.toolCallId ?? `${i}`)
    if (step) {
      pending.push(step)
      return
    }
    flush(i)
    if (p.type === "text") {
      blocks.push(<Markdown key={i} text={(p as { text: string }).text} reading />)
    } else if (p.type === "file") {
      blocks.push(<FilePart key={i} part={p} />)
    }
  })
  flush(parts.length)

  async function copyText() {
    const text = extractText(message)
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Resposta copiada")
    setTimeout(() => setCopied(false), 1500)
  }

  const canRegenerate = isLast && onRegenerate && !isStreaming
  const hasText = parts.some((p) => p.type === "text" && (p as { text: string }).text.trim())

  return (
    <div className="group space-y-1">
      {blocks}
      {!isStreaming && hasText && (
        <div
          className={cn(
            "flex items-center gap-1 pt-1 text-muted-foreground transition-opacity",
            "opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100",
            isLast && "opacity-100"
          )}
        >
          <ActionButton label={copied ? "Copiado" : "Copiar resposta"} onClick={copyText}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </ActionButton>
          {canRegenerate && (
            <ActionButton label="Gerar de novo" onClick={onRegenerate}>
              <RefreshCw className="size-4" />
            </ActionButton>
          )}
        </div>
      )}
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-8 place-items-center rounded-md hover:bg-accent hover:text-foreground transition-colors pointer-coarse:size-11"
    >
      {children}
    </button>
  )
}

// Memoizado: durante o streaming só a última mensagem muda de referência,
// então as anteriores não re-renderizam nem reparseiam o markdown a cada token.
export const MessageBubble = memo(function MessageBubble(props: MessageBubbleProps) {
  return props.message.role === "user" ? (
    <UserMessage message={props.message} />
  ) : (
    <AssistantMessage {...props} />
  )
})
