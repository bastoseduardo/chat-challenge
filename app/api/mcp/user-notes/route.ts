import { NextResponse, type NextRequest } from "next/server"
import { saveNote, listNotes, searchNotes } from "@/lib/db/queries/notes"

/**
 * MCP Server (JSON-RPC 2.0 over HTTP) — "user-notes".
 *
 * Autenticação: header `X-User-Id` (UUID do profile). Esse endpoint é chamado
 * SOMENTE pelo /api/chat deste deploy, que injeta o header do user autenticado.
 * Em terceiros seria necessário OAuth MCP — fora do escopo do MVP.
 *
 * Métodos suportados: initialize, tools/list, tools/call.
 */

const SERVER_INFO = {
  name: "user-notes",
  title: "User Notes",
  version: "1.0.0",
}

const PROTOCOL_VERSION = "2025-06-18"

const TOOLS = [
  {
    name: "save_note",
    title: "Save Note",
    description: "Salva uma nota pessoal do usuário. Use para registrar fatos, decisões, lembretes.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Conteúdo da nota" },
      },
      required: ["content"],
    },
  },
  {
    name: "list_notes",
    title: "List Notes",
    description: "Lista as notas mais recentes do usuário (até 20).",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Número máximo de notas",
          default: 20,
        },
      },
    },
  },
  {
    name: "search_notes",
    title: "Search Notes",
    description: "Busca nas notas do usuário por texto (case-insensitive).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto a buscar" },
      },
      required: ["query"],
    },
  },
]

function jsonrpcResult(id: number | string, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result }
}

function jsonrpcError(id: number | string | null, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } }
}

function textContent(text: string) {
  return { content: [{ type: "text", text }] }
}

async function handle(method: string, params: Record<string, unknown> | undefined, userId: string) {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Esse servidor armazena notas pessoais do usuário logado. Use save_note para registrar algo relevante, list_notes para ver o histórico e search_notes para encontrar algo específico.",
      }

    case "tools/list":
      return { tools: TOOLS }

    case "tools/call": {
      const name = (params as { name?: string } | undefined)?.name
      const args = (params as { arguments?: Record<string, unknown> } | undefined)?.arguments ?? {}

      if (name === "save_note") {
        const content = String(args.content ?? "").trim()
        if (!content) return textContent("Erro: conteúdo vazio")
        const row = await saveNote(userId, content)
        return textContent(`Nota salva (id=${row.id.slice(0, 8)}, em ${row.createdAt.toISOString()})`)
      }

      if (name === "list_notes") {
        const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20)))
        const rows = await listNotes(userId, limit)
        if (rows.length === 0) return textContent("Nenhuma nota salva.")
        const lines = rows.map(
          (r, i) =>
            `${i + 1}. [${r.createdAt.toISOString().slice(0, 10)}] ${r.content.slice(0, 200)}`
        )
        return textContent(lines.join("\n"))
      }

      if (name === "search_notes") {
        const query = String(args.query ?? "").trim()
        if (!query) return textContent("Erro: query vazia")
        const rows = await searchNotes(userId, query, 10)
        if (rows.length === 0) return textContent(`Nenhuma nota encontrada para "${query}".`)
        const lines = rows.map(
          (r, i) =>
            `${i + 1}. [${r.createdAt.toISOString().slice(0, 10)}] ${r.content.slice(0, 300)}`
        )
        return textContent(lines.join("\n"))
      }

      return textContent(`Tool desconhecida: ${name}`)
    }

    default:
      return null
  }
}

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id")
  if (!userId) {
    return NextResponse.json(jsonrpcError(null, -32001, "Missing X-User-Id header"), { status: 401 })
  }

  let body: {
    jsonrpc?: string
    id?: number | string
    method?: string
    params?: Record<string, unknown>
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(jsonrpcError(null, -32700, "Parse error"), { status: 400 })
  }

  // Notificação (sem id) → 202 Accepted
  if (body.id === undefined) {
    return new NextResponse(null, { status: 202 })
  }

  const method = body.method ?? ""
  try {
    const result = await handle(method, body.params, userId)
    if (result === null) {
      return NextResponse.json(
        jsonrpcError(body.id, -32601, `Method not found: ${method}`),
        { status: 200 }
      )
    }
    return NextResponse.json(jsonrpcResult(body.id, result), { status: 200 })
  } catch (err) {
    console.error("[mcp/user-notes]", err)
    const msg = err instanceof Error ? err.message : "internal"
    return NextResponse.json(jsonrpcError(body.id, -32603, msg), { status: 200 })
  }
}

export async function GET() {
  return NextResponse.json({
    server: SERVER_INFO,
    protocol: PROTOCOL_VERSION,
    tools: TOOLS.map((t) => t.name),
    hint: "This is a Streamable HTTP MCP server. POST JSON-RPC 2.0 requests with X-User-Id header.",
  })
}
