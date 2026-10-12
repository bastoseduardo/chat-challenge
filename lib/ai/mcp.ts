import { createMCPClient } from "@ai-sdk/mcp"
import type { ToolSet } from "ai"
import { logAudit } from "@/lib/audit/log"

export interface McpServerConfig {
  name: string
  transport: {
    type: "sse" | "http"
    url: string
    headers?: Record<string, string>
  }
}

export interface McpConfig {
  servers?: McpServerConfig[]
}

export interface LoadedMcp {
  tools: ToolSet
  clients: Array<{ close(): Promise<void> | void }>
  connectedServers: string[]
}

/**
 * Lê o mcp_config do usuário e carrega as tools dos servers configurados.
 * Para endpoints no mesmo deploy, injeta X-User-Id automaticamente.
 */
export async function loadMcpTools(opts: {
  userId: string
  mcpConfig: unknown
}): Promise<LoadedMcp> {
  const out: LoadedMcp = { tools: {}, clients: [], connectedServers: [] }

  const config = opts.mcpConfig as McpConfig | undefined
  if (!config?.servers?.length) return out

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  for (const server of config.servers) {
    try {
      const isInternal = appUrl && server.transport.url.startsWith(appUrl)
      const headers: Record<string, string> = {
        ...(server.transport.headers ?? {}),
      }
      if (isInternal) {
        headers["X-User-Id"] = opts.userId
      }

      const client = await createMCPClient({
        transport: {
          type: server.transport.type,
          url: server.transport.url,
          headers,
        },
        protocolVersionDiscovery: false,
      })

      const serverTools = await client.tools()
      // prefix tool names with server name to avoid collisions
      const prefix = server.name.replace(/[^a-zA-Z0-9_]/g, "_")
      for (const [toolName, toolDef] of Object.entries(serverTools)) {
        out.tools[`${prefix}__${toolName}`] = toolDef
      }
      out.clients.push(client)
      out.connectedServers.push(server.name)

      await logAudit({
        userId: opts.userId,
        eventType: "mcp.server.connected",
        resourceType: "mcp_server",
        metadata: { name: server.name, url: server.transport.url, tool_count: Object.keys(serverTools).length },
      })
    } catch (err) {
      console.error(`[mcp] server "${server.name}" failed:`, err)
      await logAudit({
        userId: opts.userId,
        eventType: "mcp.server.connected",
        resourceType: "mcp_server",
        metadata: {
          name: server.name,
          error: err instanceof Error ? err.message : "unknown",
          success: false,
        },
      })
    }
  }

  return out
}

export async function closeMcpClients(clients: LoadedMcp["clients"]): Promise<void> {
  await Promise.allSettled(clients.map((c) => c.close?.()))
}
