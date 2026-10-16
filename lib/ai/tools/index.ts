import type { ToolSet } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { webSearchTool } from "./web-search"
import { webScrapeTool } from "./web-scrape"
import { getCurrentTimeTool } from "./get-current-time"
import { buildDriveTools } from "./drive"

export type BuiltinToolName =
  | "web_search"
  | "web_scrape"
  | "get_current_time"
  | "drive_search_files"
  | "drive_read_file"

export const ALL_BUILTIN_TOOL_NAMES: BuiltinToolName[] = [
  "web_search",
  "web_scrape",
  "get_current_time",
  "drive_search_files",
  "drive_read_file",
]

/*
 * Busca e leitura de páginas: ferramentas nativas da Anthropic, versões básicas
 * (decisão em docs/round-4/decisions/citations.md). Elas devolvem citações
 * prontas por trecho de texto. As versões _20260209 foram descartadas: rodam
 * code_execution por baixo e poluem a trilha. Tavily/Jina continuam como plano
 * de volta com WEB_TOOLS_PROVIDER=tavily.
 *
 * Os ids dos toggles em Configurações não mudam: "web_scrape" liga a leitura,
 * que no modelo se chama "web_fetch".
 */
const useTavily = process.env.WEB_TOOLS_PROVIDER === "tavily"

function webTools(name: BuiltinToolName): ToolSet {
  if (name === "web_search") {
    return useTavily
      ? { web_search: webSearchTool }
      : { web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }) }
  }
  if (name === "web_scrape") {
    return useTavily
      ? { web_scrape: webScrapeTool }
      : { web_fetch: anthropic.tools.webFetch_20250910({ maxUses: 2, citations: { enabled: true } }) }
  }
  return {}
}

const SIMPLE_TOOLS: Partial<Record<BuiltinToolName, ToolSet[string]>> = {
  get_current_time: getCurrentTimeTool,
}

export interface BuiltinToolsOptions {
  enabled: BuiltinToolName[]
  driveToken?: string | null
}

export function getBuiltinTools(opts: BuiltinToolsOptions): ToolSet {
  const out: ToolSet = {}

  // Simples (sem contexto)
  for (const name of opts.enabled) {
    const t = SIMPLE_TOOLS[name]
    if (t) out[name] = t
    Object.assign(out, webTools(name))
  }

  // Drive — precisa de token
  const driveEnabled =
    opts.enabled.includes("drive_search_files") ||
    opts.enabled.includes("drive_read_file")
  if (driveEnabled) {
    const driveTools = buildDriveTools({ providerToken: opts.driveToken ?? null })
    for (const name of ["drive_search_files", "drive_read_file"] as const) {
      if (opts.enabled.includes(name) && driveTools[name]) {
        out[name] = driveTools[name]
      }
    }
  }

  return out
}
