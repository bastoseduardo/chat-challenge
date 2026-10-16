import { describe, expect, it } from "vitest"
import type { UIMessage } from "ai"
import { aggregateSources, citationsByPart, extractSources, footnotesMarkdown, sourceLabel, textWithCitations } from "@/lib/sources/extract"

// Formato real observado no spike (docs/round-4/decisions/citations.md).
const web = (url: string, citedText: string, title = "Título") => ({
  citedText,
  source: { type: "source", sourceType: "url", id: url, url, title, providerMetadata: { anthropic: {} } },
})

const doc = (start: number, endExclusive: number, citedText: string) => ({
  citedText,
  source: {
    type: "source",
    sourceType: "document",
    id: "0",
    title: "paper.pdf",
    mediaType: "application/pdf",
    providerMetadata: {
      anthropic: { type: "page_location", start_page_number: start, end_page_number: endExclusive, cited_text: citedText },
    },
  },
})

const msg = (parts: unknown[]): UIMessage =>
  ({ id: "m1", role: "assistant", parts }) as unknown as UIMessage

describe("extractSources", () => {
  it("lê citações web dos TextUIPart e numera por primeira aparição", () => {
    const m = msg([
      { type: "text", text: "A versão é 18.", citations: [web("https://www.postgresql.org/support/versioning/", "Each major version...")] },
      { type: "text", text: " Suporte até 2030.", citations: [web("https://acemq.com/eol", "until 2030")] },
    ])
    const s = extractSources(m)
    expect(s.map((x) => x.index)).toEqual([1, 2])
    expect(s[0]).toMatchObject({ kind: "web", domain: "postgresql.org", quotes: ["Each major version..."] })
  })

  it("junta citações da mesma URL numa fonte só, sem repetir trecho", () => {
    const url = "https://www.postgresql.org/support/versioning/"
    const m = msg([
      { type: "text", text: "a", citations: [web(url, "trecho 1")] },
      { type: "text", text: "b", citations: [web(url, "trecho 2"), web(url, "trecho 1")] },
    ])
    const s = extractSources(m)
    expect(s).toHaveLength(1)
    expect(s[0].quotes).toEqual(["trecho 1", "trecho 2"])
  })

  it("converte páginas de PDF (end_page_number exclusivo) em intervalo inclusivo", () => {
    const m = msg([{ type: "text", text: "d_model = 512", citations: [doc(3, 4, "dmodel = 512")] }])
    const [s] = extractSources(m)
    expect(s).toMatchObject({ kind: "document", title: "paper.pdf", pages: { start: 3, end: 3 } })
    expect(sourceLabel(s)).toBe("paper.pdf, p. 3")
  })

  it("mostra faixa quando a citação cobre mais de uma página", () => {
    const [s] = extractSources(msg([{ type: "text", text: "x", citations: [doc(4, 6, "y")] }]))
    expect(sourceLabel(s)).toBe("paper.pdf, p. 4–5")
  })

  it("ignora source-url (resultados de busca) e aproveita source-document", () => {
    const m = msg([
      { type: "source-url", sourceId: "r1", url: "https://resultado-de-busca.com", title: "Resultado" },
      {
        type: "source-document",
        sourceId: "d1",
        mediaType: "application/pdf",
        title: "paper.pdf",
        providerMetadata: { anthropic: { citedText: "trecho", startPageNumber: 2, endPageNumber: 3 } },
      },
    ])
    const s = extractSources(m)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ kind: "document", pages: { start: 2, end: 2 }, quotes: ["trecho"] })
  })

  it("devolve vazio quando a mensagem não tem fontes", () => {
    expect(extractSources(msg([{ type: "text", text: "Olá" }]))).toEqual([])
  })
})

describe("citationsByPart", () => {
  it("mapeia o índice de cada parte de texto pros números das fontes citadas", () => {
    const m = msg([
      { type: "step-start" },
      { type: "text", text: "a", citations: [web("https://a.com", "1")] },
      { type: "text", text: "b" },
      { type: "text", text: "c", citations: [web("https://b.com", "2"), web("https://a.com", "3")] },
    ])
    const map = citationsByPart(m)
    expect(map.get(1)).toEqual([1])
    expect(map.has(2)).toBe(false)
    expect(map.get(3)).toEqual([2, 1])
  })
})

describe("textWithCitations", () => {
  it("junta blocos citados sem quebrar a frase e separa etapas com parágrafo", () => {
    const m = msg([
      { type: "step-start" },
      { type: "text", text: "Vou pesquisar." },
      { type: "tool-web_search", toolCallId: "t", state: "output-available", input: {}, output: [] },
      { type: "step-start" },
      { type: "text", text: "A versão é **18**.", citations: [web("https://a.com", "x")] },
      { type: "text", text: " " },
      { type: "text", text: "Suporte até 2030.\n", citations: [web("https://b.com", "y")] },
    ])
    expect(textWithCitations(m, (ix) => ix.map((i) => `[${i}]`).join(""))).toBe(
      "Vou pesquisar.\n\nA versão é **18**.[1] Suporte até 2030.[2]"
    )
  })

  it("gera notas de rodapé pra web e PDF", () => {
    const m = msg([
      { type: "text", text: "a", citations: [web("https://www.postgresql.org/x", "q", "Versioning")] },
      { type: "text", text: "b", citations: [doc(3, 4, "dmodel")] },
    ])
    expect(footnotesMarkdown(extractSources(m))).toBe(
      "[^1]: Versioning, https://www.postgresql.org/x\n[^2]: paper.pdf, p. 3"
    )
  })
})

describe("aggregateSources", () => {
  it("junta fontes de várias respostas sem repetir", () => {
    const a = msg([{ type: "text", text: "a", citations: [web("https://a.com", "1"), web("https://b.com", "2")] }])
    const b = msg([{ type: "text", text: "b", citations: [web("https://b.com", "3"), doc(3, 4, "d")] }])
    const all = aggregateSources([a, b])
    expect(all.map((s) => s.url ?? s.title)).toEqual(["https://a.com", "https://b.com", "paper.pdf"])
    expect(all[1].quotes).toEqual(["2", "3"])
  })
})
