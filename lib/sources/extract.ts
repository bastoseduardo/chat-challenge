import type { UIMessage } from "ai"
import type { Source } from "./types"

/*
 * As citações vêm prontas do provider (decisão em docs/round-4/decisions/citations.md):
 * - cada TextUIPart citado traz `citations: Array<{ citedText, source }>`, web e PDF;
 * - partes `source-document` repetem as citações de PDF, intercaladas;
 * - partes `source-url` logo após uma busca são RESULTADOS da busca, não citações;
 * - citações de página lida pelo `web_fetch` também vêm como `document`
 *   (text/plain, char_location), com o título do resultado do fetch: viram
 *   fonte web com a URL lida.
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

/** título da página → URL, dos resultados do `web_fetch` da mensagem */
type FetchedPages = Map<string, string>

function fetchedPages(parts: AnyPart[]): FetchedPages {
  const pages: FetchedPages = new Map()
  for (const part of parts) {
    if (part.type !== "tool-web_fetch") continue
    const output = (part as { output?: { url?: unknown; content?: { title?: unknown } } }).output
    const url = typeof output?.url === "string" ? output.url : undefined
    const title = typeof output?.content?.title === "string" ? output.content.title : undefined
    if (url) pages.set(title || url, url)
  }
  return pages
}

function candidateFromCitation(c: RawCitation, fetched: FetchedPages): Candidate | null {
  const s = c.source
  if (!s) return null
  if (s.sourceType === "url" && s.url) {
    return { kind: "web", title: s.title || domainOf(s.url), url: s.url, quote: c.citedText, sourceId: s.id }
  }
  const fetchedUrl = s.title ? fetched.get(s.title) : undefined
  if (s.sourceType === "document" && fetchedUrl) {
    return { kind: "web", title: s.title!, url: fetchedUrl, quote: c.citedText, sourceId: s.id }
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

  const parts = message.parts as AnyPart[]
  const fetched = fetchedPages(parts)
  parts.forEach((part, i) => {
    if (part.type === "text" && Array.isArray(part.citations)) {
      const indexes: number[] = []
      for (const citation of part.citations) {
        const c = candidateFromCitation(citation, fetched)
        if (!c) continue
        const index = add(c)
        if (!indexes.includes(index)) indexes.push(index)
      }
      if (indexes.length > 0) byPart.set(i, indexes)
    } else if (part.type === "source-document") {
      const meta = part.providerMetadata?.anthropic
      const fetchedUrl = part.title ? fetched.get(part.title) : undefined
      if (fetchedUrl) {
        add({
          kind: "web",
          title: part.title!,
          url: fetchedUrl,
          quote: typeof meta?.citedText === "string" ? meta.citedText : undefined,
          sourceId: part.sourceId,
        })
        return
      }
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

/** Insere `mark` no fim do texto, antes de espaços e quebras finais. */
export function appendBeforeTrailingSpace(text: string, mark: string): string {
  const match = /\s*$/.exec(text)
  const cut = match ? match.index : text.length
  return text.slice(0, cut) + mark + text.slice(cut)
}

/**
 * Junta os TextUIPart da mensagem num texto só. O provider divide a resposta em
 * vários blocos (um por trecho citado), que são concatenados sem separador;
 * entre etapas (ferramenta ou step-start no meio) entra uma quebra de parágrafo.
 * `mark` recebe os números das fontes de cada trecho citado e devolve o que
 * inserir no fim dele (ex.: "[^1]" no export, "[1]" ao copiar).
 */
export function textWithCitations(
  message: UIMessage,
  mark: (indexes: number[]) => string = () => ""
): string {
  const byPart = citationsByPart(message)
  let out = ""
  let boundary = false
  ;(message.parts as AnyPart[]).forEach((part, i) => {
    if (part.type === "text") {
      const text = (part as { text?: string }).text ?? ""
      if (boundary && out.trim()) out = out.replace(/\s*$/, "") + "\n\n"
      boundary = false
      const indexes = byPart.get(i)
      out += indexes?.length ? appendBeforeTrailingSpace(text, mark(indexes)) : text
    } else if (part.type === "step-start" || part.type.startsWith("tool-") || part.type === "dynamic-tool") {
      boundary = true
    }
  })
  return out.trim()
}

/** Notas de rodapé em Markdown: "[^1]: Título, https://..." */
export function footnotesMarkdown(sources: Source[]): string {
  return sources
    .map((s) => `[^${s.index}]: ${s.kind === "web" ? `${s.title}, ${s.url}` : sourceLabel(s)}`)
    .join("\n")
}

/**
 * Fontes de várias mensagens, sem repetição (mesma URL, ou mesmo documento e
 * páginas). A numeração devolvida é só de ordem; cada resposta mantém a sua.
 */
export function aggregateSources(messages: UIMessage[]): Source[] {
  const out: Source[] = []
  const seen = new Map<string, Source>()
  for (const m of messages) {
    for (const s of extractSources(m)) {
      const key = s.kind === "web" ? `web:${s.url}` : `doc:${s.title}:${s.pages?.start ?? ""}-${s.pages?.end ?? ""}`
      const existing = seen.get(key)
      if (existing) {
        for (const q of s.quotes) if (!existing.quotes.includes(q)) existing.quotes.push(q)
        continue
      }
      const copy = { ...s, index: out.length + 1, quotes: [...s.quotes], sourceIds: [...s.sourceIds] }
      seen.set(key, copy)
      out.push(copy)
    }
  }
  return out
}
