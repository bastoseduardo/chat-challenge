import { tool } from "ai"
import { z } from "zod"

const MAX_LENGTH = 20_000

export const webScrapeTool = tool({
  description:
    "Lê o conteúdo de uma URL e retorna como texto em markdown. Use quando precisar extrair conteúdo detalhado de uma página.",
  inputSchema: z.object({
    url: z.string().url().describe("URL completa da página"),
  }),
  execute: async ({ url }) => {
    try {
      const target = `https://r.jina.ai/${url}`
      const res = await fetch(target, {
        headers: { Accept: "text/plain" },
      })
      if (!res.ok) {
        return { error: `Jina Reader ${res.status}`, url }
      }
      const text = await res.text()
      const truncated = text.slice(0, MAX_LENGTH)
      return {
        url,
        markdown: truncated,
        truncated: text.length > MAX_LENGTH,
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "scrape_failed", url }
    }
  },
})
