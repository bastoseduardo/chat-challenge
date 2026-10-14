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

/**
 * Decide se a URL do MCP server aponta pra um server interno deste app.
 * Usa o PATH como chave (não o host): se o mcp_config do usuário tem URL
 * com path `/api/mcp/user-notes`, usamos sempre in-memory, independente
 * do host configurado — resolve o caso de dev local onde a config tem
 * URL de produção (e vice-versa, e deploys preview). Como o handler
 * filtra por userId da sessão, não há vazamento de dados entre users.
 */
function pickInternalPath(url: string): string | null {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }
  for (const key of Object.keys(INTERNAL_SERVERS)) {
    if (path === key || path.startsWith(key + "/")) return key
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

  for (const server of config.servers) {
    try {
      const internalPath = pickInternalPath(server.transport.url)

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
      console.error(
        `[mcp] server "${server.name}" (${server.transport.url}) failed:`,
        err
      )
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
