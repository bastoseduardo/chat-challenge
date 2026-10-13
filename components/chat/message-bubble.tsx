"use client"

import type { UIMessage } from "ai"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { cn } from "@/lib/utils"
import { ToolCallCard } from "./tool-call-card"
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
      </div>
    </div>
  )
}
