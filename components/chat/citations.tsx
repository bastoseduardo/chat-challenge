"use client"

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { ExternalLink } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { sourceLabel } from "@/lib/sources/extract"
import type { Source } from "@/lib/sources/types"

/*
 * Citações na resposta (SPEC-R4-003). Os números vêm de lib/sources: cada
 * trecho de texto citado recebe um marcador invisível no fim
 * (CITE_OPEN + "1,2" + CITE_CLOSE); o plugin rehype abaixo troca o marcador por
 * <sup data-cite="1,2">, que o Markdown renderiza como CitationMarks.
 */

export const CITE_OPEN = ""
export const CITE_CLOSE = ""
export const citeMarker = (indexes: number[]) => `${CITE_OPEN}${indexes.join(",")}${CITE_CLOSE}`

// ─── Contexto da mensagem: fontes + destaque cruzado com a trilha ──────────

type Hover = { kind: "source"; index: number } | { kind: "step"; key: string } | null

interface CitationState {
  sources: Source[]
  /** fontes que cada passo da trilha gerou (pra destacar ao passar o mouse) */
  sourcesByStep: Map<string, number[]>
  hover: Hover
  setHover: (h: Hover) => void
}

const CitationContext = createContext<CitationState | null>(null)

export function CitationProvider({
  sources,
  sourcesByStep,
  children,
}: {
  sources: Source[]
  sourcesByStep: Map<string, number[]>
  children: ReactNode
}) {
  const [hover, setHover] = useState<Hover>(null)
  const value = useMemo(
    () => ({ sources, sourcesByStep, hover, setHover }),
    [sources, sourcesByStep, hover]
  )
  return <CitationContext.Provider value={value}>{children}</CitationContext.Provider>
}

/** Fontes destacadas agora (por hover num passo da trilha ou numa marcação). */
function useHighlightedSources(): Set<number> {
  const ctx = useContext(CitationContext)
  return useMemo(() => {
    if (!ctx?.hover) return new Set<number>()
    if (ctx.hover.kind === "source") return new Set([ctx.hover.index])
    return new Set(ctx.sourcesByStep.get(ctx.hover.key) ?? [])
  }, [ctx])
}

/** Passos da trilha destacados agora, e o handler de hover pra eles. */
export function useStepHighlight() {
  const ctx = useContext(CitationContext)
  const highlighted = useMemo(() => {
    const keys = new Set<string>()
    if (!ctx?.hover) return keys
    if (ctx.hover.kind === "step") keys.add(ctx.hover.key)
    else {
      const hovered = ctx.hover.index
      for (const [key, indexes] of ctx.sourcesByStep) if (indexes.includes(hovered)) keys.add(key)
    }
    return keys
  }, [ctx])
  return {
    highlighted,
    onHoverStep: (key: string | null) => ctx?.setHover(key ? { kind: "step", key } : null),
  }
}

// ─── Marcação [n] com cartão da fonte ──────────────────────────────────────

function CitationMark({ index }: { index: number }) {
  const ctx = useContext(CitationContext)
  const highlighted = useHighlightedSources().has(index)
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const source = ctx?.sources.find((s) => s.index === index)
  if (!source) return null

  // Hover abre no desktop; clique/toque e teclado (Enter) também abrem.
  const openSoon = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
    ctx?.setHover({ kind: "source", index })
  }
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => {
      setOpen(false)
      ctx?.setHover(null)
    }, 120)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          // Clique/toque/Enter sempre ABRE (não alterna): no toque o mouseenter
          // já abriu, e o toggle padrão do Radix fecharia em seguida. Fecha com
          // Esc, clique fora ou saindo com o mouse.
          onClick={(e) => {
            e.preventDefault()
            openSoon()
          }}
          onMouseEnter={openSoon}
          onMouseLeave={closeSoon}
          onFocus={() => ctx?.setHover({ kind: "source", index })}
          onBlur={() => ctx?.setHover(null)}
          aria-label={`Fonte ${index}: ${sourceLabel(source)}`}
          data-highlight={highlighted || undefined}
          className={cn(
            "citation-mark mx-px inline-flex h-[1.15em] min-w-[1.15em] -translate-y-[0.35em] items-center justify-center rounded-sm px-[0.2em] align-baseline font-sans text-[0.68em] font-semibold leading-none text-tool tabular-nums transition-colors",
            "hover:bg-tool-soft data-[highlight]:bg-tool-soft data-[highlight]:ring-1 data-[highlight]:ring-tool/50",
            "pointer-coarse:h-6 pointer-coarse:min-w-6"
          )}
        >
          {index}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] space-y-2.5 p-3.5 font-sans"
        onMouseEnter={openSoon}
        onMouseLeave={closeSoon}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SourceCardBody source={source} />
      </PopoverContent>
    </Popover>
  )
}

function SourceCardBody({ source }: { source: Source }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-sm bg-tool-soft text-[11px] font-semibold text-tool tabular-nums">
          {source.index}
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{source.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {source.kind === "document" ? `PDF${pagesText(source)}` : sourceLabel(source)}
          </p>
        </div>
      </div>
      {source.quotes.slice(0, 2).map((q) => (
        <blockquote
          key={q}
          className="line-clamp-4 border-l-2 border-tool/60 pl-2.5 font-serif text-[13px] leading-relaxed text-foreground/90"
        >
          “{plainQuote(q)}”
        </blockquote>
      ))}
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          Abrir fonte
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
    </>
  )
}

/**
 * Trecho citado como texto corrido: o provider devolve o trecho cru da página,
 * às vezes em Markdown (tabelas, títulos). Tira a marcação pra caber no cartão.
 */
function plainQuote(q: string): string {
  return q
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?/g, " ")
    .replace(/[|*_`>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** ", p. 3" ou ", p. 4–5" (vazio sem página). */
function pagesText(s: Source): string {
  if (!s.pages) return ""
  const { start, end } = s.pages
  return `, p. ${start === end ? start : `${start}–${end}`}`
}

/** Um grupo de marcações ([1][2]) inserido no fim de um trecho citado. */
export function CitationMarks({ indexes }: { indexes: number[] }) {
  return (
    <span className="citation-marks whitespace-nowrap">
      {indexes.map((i) => (
        <CitationMark key={i} index={i} />
      ))}
    </span>
  )
}

// ─── Plugin rehype: marcador invisível → <sup data-cite> ───────────────────

interface HastNode {
  type: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const MARK_RE = new RegExp(`${CITE_OPEN}([\\d,]+)${CITE_CLOSE}`, "g")

export function rehypeCitationMarks() {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      if (!node.children) return
      const next: HastNode[] = []
      for (const child of node.children) {
        if (child.type === "text" && child.value?.includes(CITE_OPEN)) {
          let last = 0
          for (const m of child.value.matchAll(MARK_RE)) {
            if (m.index > last) next.push({ type: "text", value: child.value.slice(last, m.index) })
            next.push({ type: "element", tagName: "sup", properties: { dataCite: m[1] }, children: [] })
            last = m.index + m[0].length
          }
          if (last < child.value.length) next.push({ type: "text", value: child.value.slice(last) })
        } else {
          visit(child)
          next.push(child)
        }
      }
      node.children = next
    }
    visit(tree)
  }
}

// ─── Lista "Fontes" e linha de confiança ───────────────────────────────────

export function SourcesList({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState(false)
  const highlighted = useHighlightedSources()
  const ctx = useContext(CitationContext)
  if (sources.length === 0) return null
  const visible = expanded ? sources : sources.slice(0, 3)

  return (
    <section aria-label="Fontes citadas" className="mt-4 font-sans">
      <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">Fontes</h3>
      <ol className="space-y-1">
        {visible.map((s) => (
          <li
            key={s.index}
            onMouseEnter={() => ctx?.setHover({ kind: "source", index: s.index })}
            onMouseLeave={() => ctx?.setHover(null)}
            data-highlight={highlighted.has(s.index) || undefined}
            className="flex min-w-0 items-baseline gap-2 rounded-sm px-1 py-0.5 text-sm transition-colors data-[highlight]:bg-tool-soft"
          >
            <span className="w-5 shrink-0 text-right text-xs font-semibold text-tool tabular-nums">{s.index}</span>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:underline">
                {s.title}
              </a>
            ) : (
              <span className="min-w-0 truncate">{s.title}</span>
            )}
            <span className="shrink-0 truncate text-xs text-muted-foreground">
              {s.kind === "document" ? pagesText(s).replace(/^, /, "") : sourceLabel(s)}
            </span>
          </li>
        ))}
      </ol>
      {sources.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 px-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          {expanded ? "Mostrar menos" : `Ver todas as ${sources.length} fontes`}
        </button>
      )}
    </section>
  )
}

const shortMonth = new Intl.DateTimeFormat("pt-BR", { month: "short" })
const monthYear = (d: Date) => `${shortMonth.format(d).replace(".", "")}/${d.getFullYear()}`

/**
 * Sinal leve de confiança: quantas fontes e a data da mais recente (quando a
 * busca informa a idade da página). Não mede "confiança"; só descreve.
 */
export function trustLine(sources: Source[], pageAges: Map<string, string | null>, usedWeb: boolean): string | null {
  if (sources.length === 0) return usedWeb ? "Pesquisou, mas não citou fontes" : null
  const count = `${sources.length} ${sources.length === 1 ? "fonte" : "fontes"}`
  let newest: Date | null = null
  for (const s of sources) {
    const age = s.url ? pageAges.get(s.url) : null
    const days = age ? /(\d+)\s+day/.exec(age)?.[1] : undefined
    if (days === undefined) continue
    const d = new Date(Date.now() - Number(days) * 86_400_000)
    if (!newest || d > newest) newest = d
  }
  return newest ? `${count}, a mais recente de ${monthYear(newest)}` : count
}
