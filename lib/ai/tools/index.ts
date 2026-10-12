import type { ToolSet } from "ai"
import { webSearchTool } from "./web-search"
import { webScrapeTool } from "./web-scrape"
import { getCurrentTimeTool } from "./get-current-time"

export type BuiltinToolName = "web_search" | "web_scrape" | "get_current_time"

export const ALL_BUILTIN_TOOLS: Record<BuiltinToolName, ToolSet[string]> = {
  web_search: webSearchTool,
  web_scrape: webScrapeTool,
  get_current_time: getCurrentTimeTool,
}

export function getBuiltinTools(enabled: BuiltinToolName[]): ToolSet {
  const out: ToolSet = {}
  for (const name of enabled) {
    const t = ALL_BUILTIN_TOOLS[name]
    if (t) out[name] = t
  }
  return out
}
