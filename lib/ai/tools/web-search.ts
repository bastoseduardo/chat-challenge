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
      return { error: "TAVILY_API_KEY não configurada" }
    }
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results,
        include_answer: false,
        search_depth: "basic",
      }),
    })
    if (!res.ok) {
      return { error: `Tavily ${res.status}` }
    }
    const data = (await res.json()) as {
      results?: Array<{ title: string; url: string; content: string; published_date?: string }>
    }
    return {
      query,
      results:
        data.results?.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: (r.content || "").slice(0, 400),
          published_date: r.published_date,
        })) ?? [],
    }
  },
})
