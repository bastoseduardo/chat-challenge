"use client"

import type { UIMessage } from "ai"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { cn } from "@/lib/utils"
import { ToolCallCard } from "./tool-call-card"
import { Copy, RefreshCw, Check } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

interface MessageBubbleProps {
  message: UIMessage
  isLast?: boolean
  onRegenerate?: () => void
}

function extractMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("\n")
}

export function MessageBubble({ message, isLast, onRegenerate }: MessageBubbleProps) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)

  async function copyText() {
    const text = extractMessageText(message)
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copiado")
    setTimeout(() => setCopied(false), 1500)
  }

  const canRegenerate = !isUser && isLast && onRegenerate

  return (
    <div className={cn("group flex gap-3", isUser && "justify-end")}>
      <div
        className={cn(
          "rounded-lg px-4 py-3 max-w-[85%] space-y-2 relative",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <div
                key={i}
                className={cn("markdown", !isUser && "markdown-reading")}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {part.text}
                </ReactMarkdown>
              </div>
            )
          }
          if (part.type === "file") {
            const url =
              typeof part.url === "string" ? part.url : null
            if (!url) return null
            if (part.mediaType?.startsWith("image/")) {
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={part.filename ?? ""}
                  className="rounded max-w-xs max-h-96"
                />
              )
            }
            return (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm underline"
              >
                📎 {part.filename ?? "Arquivo"}
              </a>
            )
          }
          if (part.type?.startsWith("tool-")) {
            const toolName = part.type.replace("tool-", "")
            const toolPart = part as unknown as {
              state?: string
              input?: unknown
              output?: unknown
              errorText?: string
            }
            return <ToolCallCard key={i} toolName={toolName} part={toolPart} />
          }
          if (part.type === "dynamic-tool") {
            const dyn = part as unknown as {
              toolName?: string
              state?: string
              input?: unknown
              output?: unknown
              errorText?: string
            }
            return (
              <ToolCallCard
                key={i}
                toolName={dyn.toolName ?? "tool"}
                part={dyn}
              />
            )
          }
          return null
        })}
        {!isUser && (
          <div className="flex items-center gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={copyText}
              className="p-1 rounded hover:bg-background/60 text-muted-foreground"
              title="Copiar"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            {canRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="p-1 rounded hover:bg-background/60 text-muted-foreground"
                title="Regenerar resposta"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
