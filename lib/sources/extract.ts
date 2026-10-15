import type { UIMessage } from "ai"
import type { Source } from "./types"

/*
 * As citações vêm prontas do provider (decisão em docs/round-4/decisions/citations.md):
 * - cada TextUIPart citado traz `citations: Array<{ citedText, source }>`, web e PDF;
 * - partes `source-document` repetem as citações de PDF, intercaladas;
 * - partes `source-url` logo após uma busca são RESULTADOS da busca, não citações.
 */

interface RawCitation {
  citedText?: string
  source?: {
    sourceType?: "url" | "document"
    id?: string
    url?: string
    title?: string
    filename?: string
    providerMetadata?: { anthropic?: Record<string, unknown> }
  }
}

type AnyPart = UIMessage["parts"][number] & {
  citations?: RawCitation[]
  title?: string
  filename?: string
  sourceId?: string
  providerMetadata?: { anthropic?: Record<string, unknown> }
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Páginas inclusivas a partir dos metadados da Anthropic. O `end_page_number`
 * da API é EXCLUSIVO (medido no spike: trecho inteiro na p. 3 vem como 3..4).
 * Os metadados normalizados do `source-document` usam os mesmos números.
 */
function pagesFrom(meta: Record<string, unknown> | undefined): Source["pages"] {
  if (!meta) return undefined
  const start = num(meta.start_page_number) ?? num(meta.startPageNumber)
  const endExclusive = num(meta.end_page_number) ?? num(meta.endPageNumber)
  if (start === undefined) return undefined
  const end = endExclusive !== undefined && endExclusive > start ? endExclusive - 1 : start
  return { start, end }
}

interface Candidate {
  kind: Source["kind"]
  title: string
  url?: string
  pages?: Source["pages"]
  quote?: string
  sourceId?: string
}

function candidateFromCitation(c: RawCitation): Candidate | null {
  const s = c.source
  if (!s) return null
  if (s.sourceType === "url" && s.url) {
    return { kind: "web", title: s.title || domainOf(s.url), url: s.url, quote: c.citedText, sourceId: s.id }
  }
  if (s.sourceType === "document") {
    return {
      kind: "document",
      title: s.title || s.filename || "Documento",
      pages: pagesFrom(s.providerMetadata?.anthropic),
      quote: c.citedText,
      sourceId: s.id,
    }
  }
  return null
}

function keyOf(c: Candidate): string {
  if (c.kind === "web") return `web:${c.url}`
  return `doc:${c.title}:${c.pages?.start ?? ""}-${c.pages?.end ?? ""}`
}

function collect(message: UIMessage) {
  const sources: Source[] = []
  const byKey = new Map<string, Source>()
  const byPart = new Map<number, number[]>()

  const add = (c: Candidate): number => {
    const key = keyOf(c)
    let s = byKey.get(key)
    if (!s) {
      s = {
        index: sources.length + 1,
        kind: c.kind,
        title: c.title,
        ...(c.url ? { url: c.url, domain: domainOf(c.url) } : {}),
        ...(c.pages ? { pages: c.pages } : {}),
        quotes: [],
        sourceIds: [],
      }
      byKey.set(key, s)
      sources.push(s)
    }
    const quote = c.quote?.trim()
    if (quote && !s.quotes.includes(quote)) s.quotes.push(quote)
    if (c.sourceId && !s.sourceIds.includes(c.sourceId)) s.sourceIds.push(c.sourceId)
    return s.index
  }

  ;(message.parts as AnyPart[]).forEach((part, i) => {
    if (part.type === "text" && Array.isArray(part.citations)) {
      const indexes: number[] = []
      for (const citation of part.citations) {
        const c = candidateFromCitation(citation)
        if (!c) continue
        const index = add(c)
        if (!indexes.includes(index)) indexes.push(index)
      }
      if (indexes.length > 0) byPart.set(i, indexes)
    } else if (part.type === "source-document") {
      const meta = part.providerMetadata?.anthropic
      add({
        kind: "document",
        title: part.title || part.filename || "Documento",
        pages: pagesFrom(meta),
        quote: typeof meta?.citedText === "string" ? meta.citedText : undefined,
        sourceId: part.sourceId,
      })
    }
  })

  return { sources, byPart }
}

/** Fontes citadas na mensagem, numeradas por primeira aparição. */
export function extractSources(message: UIMessage): Source[] {
  return collect(message).sources
}

/** Pra cada índice de part (TextUIPart) da mensagem, os números das fontes que ela cita. */
export function citationsByPart(message: UIMessage): Map<number, number[]> {
  return collect(message).byPart
}

/** "postgresql.org" ou "relatorio.pdf, p. 4–5" */
export function sourceLabel(s: Source): string {
  if (s.kind === "web") return s.domain ?? s.title
  if (!s.pages) return s.title
  const { start, end } = s.pages
  return `${s.title}, p. ${start === end ? start : `${start}–${end}`}`
}
