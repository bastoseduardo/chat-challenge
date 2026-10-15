"use client"

import type { UIMessage } from "ai"
import { memo, useMemo, useState, type ReactNode } from "react"
import { Copy, RefreshCw, Check, FileText } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Markdown } from "./markdown"
import { ResearchTrail, type ToolStep } from "./research-trail"
import { ImageLightbox } from "./image-lightbox"
import { CitationProvider, SourcesList, citeMarker, trustLine } from "./citations"
import {
  appendBeforeTrailingSpace,
  citationsByPart,
  extractSources,
  sourceLabel,
  textWithCitations,
} from "@/lib/sources/extract"

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
    <div id={`msg-${message.id}`} className="flex scroll-mt-6 justify-end">
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

  const { sources, sourcesByStep, pageAges, usedWeb } = useMemo(
    () => citationData(message),
    [message]
  )
  const byPart = useMemo(() => citationsByPart(message), [message])

  // Blocos na ordem real: ferramentas consecutivas viram uma trilha; blocos de
  // texto consecutivos viram UM markdown (o provider divide o texto por trecho
  // citado; renderizar cada pedaço separado quebraria listas e parágrafos), com
  // o marcador de citação no fim de cada trecho citado.
  const blocks: ReactNode[] = []
  let pendingSteps: ToolStep[] = []
  let pendingText = ""
  let textHasCitations = false
  const flushSteps = (i: number) => {
    if (pendingSteps.length === 0) return
    const isTail = i === parts.length
    blocks.push(<ResearchTrail key={`trail-${i}`} steps={pendingSteps} live={isStreaming && isTail} />)
    pendingSteps = []
  }
  const flushText = (i: number) => {
    if (!pendingText.trim()) {
      pendingText = ""
      return
    }
    blocks.push(<Markdown key={`text-${i}`} text={pendingText} reading citations={textHasCitations} />)
    pendingText = ""
    textHasCitations = false
  }
  parts.forEach((p, i) => {
    const step = toolStepOf(p, p.toolCallId ?? `${i}`)
    if (step) {
      flushText(i)
      pendingSteps.push(step)
      return
    }
    if (p.type === "text") {
      flushSteps(i)
      const text = (p as { text: string }).text
      const indexes = byPart.get(i)
      if (indexes?.length) {
        pendingText += appendBeforeTrailingSpace(text, citeMarker(indexes))
        textHasCitations = true
      } else {
        pendingText += text
      }
      return
    }
    if (p.type === "file") {
      flushSteps(i)
      flushText(i)
      blocks.push(<FilePart key={i} part={p} />)
    }
    // source-url/source-document/step-start/custom: sem bloco próprio
  })
  flushSteps(parts.length)
  flushText(parts.length)

  async function copyText() {
    const text = textWithCitations(message, (ix) => ix.map((n) => `[${n}]`).join(""))
    if (!text) return
    const footer = sources.length
      ? "\n\nFontes:\n" +
        sources
          .map((s) => `[${s.index}] ${s.title}${s.url ? ` (${s.url})` : `, ${sourceLabel(s)}`}`)
          .join("\n")
      : ""
    await navigator.clipboard.writeText(text + footer)
    setCopied(true)
    toast.success("Resposta copiada")
    setTimeout(() => setCopied(false), 1500)
  }

  const trust = trustLine(sources, pageAges, usedWeb)

  const canRegenerate = isLast && onRegenerate && !isStreaming
  const hasText = parts.some((p) => p.type === "text" && (p as { text: string }).text.trim())

  return (
    <CitationProvider sources={sources} sourcesByStep={sourcesByStep}>
    <div id={`msg-${message.id}`} className="group scroll-mt-6 space-y-1">
      {blocks}
      {!isStreaming && <SourcesList sources={sources} />}
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
          {trust && <span className="ml-1.5 text-xs text-muted-foreground">{trust}</span>}
        </div>
      )}
    </div>
    </CitationProvider>
  )
}

/**
 * Fontes citadas e o que a trilha precisa pra destacar: quais fontes cada
 * passo gerou (resultados da busca ou URL lida) e a idade das páginas.
 */
function citationData(message: UIMessage) {
  const sources = extractSources(message)
  const parts = message.parts as AnyPart[]
  const pageAges = new Map<string, string | null>()
  const sourcesByStep = new Map<string, number[]>()
  let usedWeb = false

  parts.forEach((p, i) => {
    if (p.type === "source-url") {
      const sp = p as unknown as { url: string; providerMetadata?: { anthropic?: { pageAge?: string | null } } }
      pageAges.set(sp.url, sp.providerMetadata?.anthropic?.pageAge ?? null)
    }
    const step = toolStepOf(p, p.toolCallId ?? `${i}`)
    if (!step) return
    const name = step.toolName
    if (name !== "web_search" && name !== "web_fetch" && name !== "web_scrape") return
    usedWeb = true
    const urls = new Set<string>()
    if (Array.isArray(step.output)) {
      for (const r of step.output as Array<{ url?: string }>) if (r?.url) urls.add(r.url)
    }
    const inputUrl = (step.input as { url?: string } | undefined)?.url
    if (inputUrl) urls.add(inputUrl)
    const indexes = sources.filter((s) => s.url && urls.has(s.url)).map((s) => s.index)
    if (indexes.length) sourcesByStep.set(step.key, indexes)
  })

  return { sources, sourcesByStep, pageAges, usedWeb }
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
