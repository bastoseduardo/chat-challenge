import type { ToolSet } from "ai"
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

const SIMPLE_TOOLS: Partial<Record<BuiltinToolName, ToolSet[string]>> = {
  web_search: webSearchTool,
  web_scrape: webScrapeTool,
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
