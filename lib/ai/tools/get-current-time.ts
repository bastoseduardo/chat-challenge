import { tool } from "ai"
import { z } from "zod"

export const getCurrentTimeTool = tool({
  description: "Retorna a data e hora atual no fuso informado (default: America/Sao_Paulo).",
  inputSchema: z.object({
    timezone: z.string().optional().describe("IANA timezone, ex: America/Sao_Paulo, UTC"),
  }),
  execute: async ({ timezone = "America/Sao_Paulo" }) => {
    try {
      const now = new Date()
      const iso = now.toISOString()
      const formatted = new Intl.DateTimeFormat("pt-BR", {
        timeZone: timezone,
        dateStyle: "full",
        timeStyle: "medium",
      }).format(now)
      return { iso, formatted, timezone }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "invalid_timezone", timezone }
    }
  },
})
