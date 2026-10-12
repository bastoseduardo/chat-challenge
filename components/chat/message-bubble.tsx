"use client"

import type { UIMessage } from "ai"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { cn } from "@/lib/utils"
import "highlight.js/styles/github-dark.css"

interface MessageBubbleProps {
  message: UIMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex gap-3", isUser && "justify-end")}>
      <div
        className={cn(
          "rounded-lg px-4 py-3 max-w-[85%] space-y-2",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <div
                key={i}
                className={cn(
                  "prose prose-sm max-w-none",
                  isUser ? "prose-invert" : "dark:prose-invert"
                )}
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
            const toolPart = part as {
              type: string
              input?: unknown
              output?: unknown
              state?: string
            }
            const toolName = part.type.replace("tool-", "")
            return (
              <div
                key={i}
                className="rounded border bg-background/60 px-3 py-2 text-xs font-mono"
              >
                <div className="font-semibold mb-1">
                  🔧 {toolName}
                  {toolPart.state && (
                    <span className="ml-2 text-muted-foreground font-normal">
                      {toolPart.state}
                    </span>
                  )}
                </div>
                {toolPart.input ? (
                  <pre className="whitespace-pre-wrap text-muted-foreground">
                    {JSON.stringify(toolPart.input, null, 2).slice(0, 300)}
                  </pre>
                ) : null}
              </div>
            )
          }
          return null
        })}
      </div>
    </div>
  )
}
