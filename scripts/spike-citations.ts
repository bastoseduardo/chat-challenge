/**
 * Spike SPEC-R4-002: como as citações chegam no stream do AI SDK.
 *
 *   npx tsx scripts/spike-citations.ts web     # busca/leitura nativas da Anthropic
 *   npx tsx scripts/spike-citations.ts tavily  # fluxo atual (Tavily + Jina)
 *   npx tsx scripts/spike-citations.ts pdf     # PDF com citations.enabled
 *
 * Não toca no app nem no banco. Imprime a sequência de partes do UI stream,
 * tempo total e uso de tokens/buscas.
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file)
  if (existsSync(path)) config({ path, override: false })
}

import { streamText, type ModelMessage, type ToolSet } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { webSearchTool } from "../lib/ai/tools/web-search"
import { webScrapeTool } from "../lib/ai/tools/web-scrape"

const MODEL = "claude-sonnet-4-6"
const SYSTEM =
  "Você é um assistente de pesquisa. Ao usar ferramentas, apoie afirmações factuais nas fontes. Responda em português, em até 5 frases."

const WEB_QUESTIONS = [
  "Qual é a versão estável mais recente do PostgreSQL e até quando ela tem suporte?",
  "O que mudou no Next.js 16 em relação ao cache de dados?",
  "Qual o preço por milhão de tokens de entrada do Claude Sonnet 4.6?",
]

const PDF_URL = "https://arxiv.org/pdf/1706.03762"
const PDF_QUESTION =
  "No artigo anexado, qual é o d_model do modelo base e quantas camadas tem o encoder? Cite as páginas."

type Mode = "web" | "web-basic" | "tavily" | "pdf"

async function run(mode: Mode, messages: ModelMessage[], label: string) {
  const tools: ToolSet | undefined =
    mode === "web"
      ? {
          web_search: anthropic.tools.webSearch_20260209({ maxUses: 3 }),
          web_fetch: anthropic.tools.webFetch_20260209({ maxUses: 2, citations: { enabled: true } }),
        }
      : mode === "web-basic"
        ? {
            web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }),
            web_fetch: anthropic.tools.webFetch_20250910({ maxUses: 2, citations: { enabled: true } }),
          }
      : mode === "tavily"
        ? { web_search: webSearchTool, web_scrape: webScrapeTool }
        : undefined

  const started = Date.now()
  const result = streamText({
    model: anthropic(MODEL),
    system: SYSTEM,
    messages,
    tools,
    stopWhen: ({ steps }) => steps.length >= 6,
  })

  // Sequência compacta: T(texto) S(fonte) U(chamada de ferramenta) R(resultado)
  const sequence: string[] = []
  const texts = new Map<string, string>()
  const sources: string[] = []
  for await (const chunk of result.toUIMessageStream({ sendSources: true })) {
    switch (chunk.type) {
      case "text-start":
        sequence.push("T")
        texts.set(chunk.id, "")
        break
      case "text-delta":
        texts.set(chunk.id, (texts.get(chunk.id) ?? "") + chunk.delta)
        break
      case "text-end": {
        const cites = (chunk.providerMetadata?.anthropic as { citations?: Array<{ type: string; url?: string; cited_text?: string; start_page_number?: number }> } | undefined)?.citations
        if (cites?.length) {
          sequence.push(`C${cites.length}`)
          for (const c of cites.slice(0, 2)) {
            sources.push(`cite(${c.type}) ${c.url ?? ""} p=${c.start_page_number ?? "-"}..${(c as { end_page_number?: number }).end_page_number ?? "-"} "${(c.cited_text ?? "").slice(0, 70)}"`)
          }
        }
        break
      }
      case "source-url":
        sequence.push("S")
        sources.push(`url  ${chunk.url}  "${chunk.title ?? ""}"  meta=${JSON.stringify(chunk.providerMetadata ?? {}).slice(0, 160)}`)
        break
      case "source-document":
        sequence.push("S")
        sources.push(`doc  "${chunk.title}"  meta=${JSON.stringify(chunk.providerMetadata ?? {}).slice(0, 200)}`)
        break
      case "tool-input-available":
        sequence.push(`U(${chunk.toolName}:${JSON.stringify(chunk.input).slice(0, 60)})`)
        break
      case "tool-output-available":
        sequence.push("R")
        break
    }
  }
  const usage = await result.totalUsage
  const meta = await result.providerMetadata
  const seconds = ((Date.now() - started) / 1000).toFixed(1)

  console.log(`\n================ ${label} (${mode}) ================`)
  console.log("sequência:", sequence.join(" "))
  console.log("blocos de texto:", texts.size)
  for (const [i, t] of [...texts.values()].entries()) {
    if (t.trim()) console.log(`  T${i}: ${t.replace(/\s+/g, " ").slice(0, 160)}`)
  }
  console.log(`fontes (${sources.length}):`)
  for (const s of sources.filter((x) => x.startsWith("cite")).concat(sources.filter((x) => !x.startsWith("cite")).slice(0, 3))) console.log("  ", s)
  console.log(`tempo: ${seconds}s | tokens in/out: ${usage.inputTokens}/${usage.outputTokens}`)
  console.log("providerMetadata.anthropic.usage:", JSON.stringify((meta?.anthropic as { usage?: unknown })?.usage ?? null).slice(0, 300))
}

async function main() {
  const mode = (process.argv[2] ?? "web") as Mode
  if (mode === "pdf") {
    await run(
      "pdf",
      [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: new URL(PDF_URL),
              mediaType: "application/pdf",
              providerOptions: {
                anthropic: { citations: { enabled: true }, title: "attention-is-all-you-need.pdf" },
              },
            },
            { type: "text", text: PDF_QUESTION },
          ],
        },
      ],
      "PDF"
    )
    return
  }
  const only = process.argv[3] ? [WEB_QUESTIONS[Number(process.argv[3])]] : WEB_QUESTIONS
  for (const [i, q] of only.entries()) {
    await run(mode, [{ role: "user", content: q }], `Q${i + 1}: ${q.slice(0, 50)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
