import { tool } from "ai"
import { z } from "zod"

export const webSearchTool = tool({
  description:
    "Pesquisa na web em tempo real. Use quando precisar de informações recentes ou que não estão no seu conhecimento.",
  inputSchema: z.object({
    query: z.string().describe("Consulta de busca"),
    max_results: z.number().int().min(1).max(10).optional().default(5),
  }),
  execute: async ({ query, max_results }) => {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      console.error("[web_search] TAVILY_API_KEY not set")
      return { error: "TAVILY_API_KEY não configurada no servidor" }
    }

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results,
          include_answer: false,
          search_depth: "basic",
        }),
      })

      if (!res.ok) {
        const detail = await res.text().catch(() => "")
        console.error(`[web_search] Tavily ${res.status}:`, detail)
        return {
          error: `Tavily respondeu ${res.status}: ${detail.slice(0, 300)}`,
          query,
        }
      }

      const data = (await res.json()) as {
        results?: Array<{
          title: string
          url: string
          content: string
          published_date?: string
        }>
      }

      const results =
        data.results?.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: (r.content || "").slice(0, 400),
          published_date: r.published_date,
        })) ?? []

      console.log(`[web_search] "${query}" → ${results.length} results`)
      return { query, results }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown"
      console.error("[web_search] fetch failed:", msg)
      return { error: `Erro de rede ao chamar Tavily: ${msg}`, query }
    }
  },
})
