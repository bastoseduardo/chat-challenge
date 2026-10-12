import { createMCPClient } from "@ai-sdk/mcp"
import type { ToolSet } from "ai"
import { logAudit } from "@/lib/audit/log"
import { InMemoryMCPTransport } from "@/lib/mcp/in-memory-transport"
import { handleUserNotesRpc } from "@/lib/mcp/user-notes-handler"

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

const INTERNAL_SERVERS: Record<string, (userId: string) => InMemoryMCPTransport> = {
  "/api/mcp/user-notes": (userId) =>
    new InMemoryMCPTransport((msg) => handleUserNotesRpc(msg, userId)),
}

function pickInternalPath(url: string, appUrl: string): string | null {
  if (!appUrl) return null
  if (!url.startsWith(appUrl)) return null
  const path = url.slice(appUrl.length)
  for (const key of Object.keys(INTERNAL_SERVERS)) {
    if (path === key || path.startsWith(key + "?")) return key
  }
  return null
}

/**
 * Lê o mcp_config do usuário e carrega as tools dos servers configurados.
 * Para servers do mesmo deploy, usa transport in-memory (evita o loop
 * de serverless chamando a si mesmo via HTTP, que falha intermitentemente no Vercel).
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
      const internalPath = pickInternalPath(server.transport.url, appUrl)

      let client: Awaited<ReturnType<typeof createMCPClient>>
      if (internalPath) {
        const transport = INTERNAL_SERVERS[internalPath](opts.userId)
        client = await createMCPClient({
          transport,
          protocolVersionDiscovery: false,
        })
      } else {
        const headers: Record<string, string> = { ...(server.transport.headers ?? {}) }
        client = await createMCPClient({
          transport: {
            type: server.transport.type,
            url: server.transport.url,
            headers,
          },
          protocolVersionDiscovery: false,
        })
      }

      const serverTools = await client.tools()
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
        metadata: {
          name: server.name,
          url: server.transport.url,
          transport: internalPath ? "in-memory" : server.transport.type,
          tool_count: Object.keys(serverTools).length,
          success: true,
        },
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "unknown"
      console.error(`[mcp] server "${server.name}" failed:`, err)
      await logAudit({
        userId: opts.userId,
        eventType: "mcp.server.connected",
        resourceType: "mcp_server",
        metadata: {
          name: server.name,
          url: server.transport.url,
          error: errMsg,
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
