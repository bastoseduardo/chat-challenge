"use client"

import { useState } from "react"
import {
  Loader2,
  Wrench,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ToolPart = {
  type?: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

const PRETTY_NAMES: Record<string, string> = {
  web_search: "Web search",
  web_scrape: "Web scrape",
  get_current_time: "Horário atual",
  drive_search_files: "Buscar no Drive",
  drive_read_file: "Ler arquivo do Drive",
}

function prettifyToolName(rawName: string): string {
  // rawName do UIMessagePart type é "tool-<name>", já cortamos antes
  const parts = rawName.split("__")
  if (parts.length === 2) {
    const [server, tool] = parts
    return `${capitalize(server)} · ${PRETTY_NAMES[tool] ?? humanize(tool)}`
  }
  return PRETTY_NAMES[rawName] ?? humanize(rawName)
}

function humanize(s: string): string {
  return s
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface ToolCallCardProps {
  toolName: string
  part: ToolPart
}

export function ToolCallCard({ toolName, part }: ToolCallCardProps) {
  const state = part.state ?? "input-streaming"
  const [open, setOpen] = useState(state === "output-error")

  const config = STATE_CONFIG[state] ?? STATE_CONFIG["input-streaming"]
  const Icon = config.icon

  const hasPayload = part.input !== undefined || part.output !== undefined || part.errorText

  return (
    <div
      className={cn(
        "rounded-md border text-xs overflow-hidden transition-colors",
        config.borderClass,
        "bg-background/50"
      )}
    >
      <button
        type="button"
        onClick={() => hasPayload && setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left",
          hasPayload && "hover:bg-accent/40 cursor-pointer",
          !hasPayload && "cursor-default"
        )}
      >
        <Icon className={cn("w-4 h-4 shrink-0", config.iconClass)} />
        <span className="font-medium flex-1">{prettifyToolName(toolName)}</span>
        <span className={cn("text-xs", config.labelClass)}>
          {config.label}
        </span>
        {hasPayload && (
          open ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )
        )}
      </button>

      {open && hasPayload && (
        <div className="border-t px-3 py-2 space-y-2 bg-background/60 font-mono text-[11px]">
          {part.input !== undefined && (
            <section>
              <div className="text-muted-foreground mb-1">Input</div>
              <pre className="whitespace-pre-wrap break-words">
                {safeFormat(part.input)}
              </pre>
            </section>
          )}
          {part.output !== undefined && (
            <section>
              <div className="text-muted-foreground mb-1">Output</div>
              <pre className="whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                {safeFormat(part.output)}
              </pre>
            </section>
          )}
          {part.errorText && (
            <section>
              <div className="text-destructive mb-1">Error</div>
              <pre className="whitespace-pre-wrap break-words text-destructive">
                {part.errorText}
              </pre>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function safeFormat(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const STATE_CONFIG: Record<
  string,
  {
    icon: typeof Loader2
    iconClass: string
    label: string
    labelClass: string
    borderClass: string
  }
> = {
  "input-streaming": {
    icon: Loader2,
    iconClass: "animate-spin text-muted-foreground",
    label: "preparando",
    labelClass: "text-muted-foreground",
    borderClass: "border-muted",
  },
  "input-available": {
    icon: Wrench,
    iconClass: "text-tool",
    label: "executando",
    labelClass: "text-tool",
    borderClass: "border-tool/40",
  },
  "output-available": {
    icon: Check,
    iconClass: "text-tool",
    label: "concluído",
    labelClass: "text-muted-foreground",
    borderClass: "border-border",
  },
  "output-error": {
    icon: AlertCircle,
    iconClass: "text-destructive",
    label: "erro",
    labelClass: "text-destructive",
    borderClass: "border-destructive/40",
  },
}
