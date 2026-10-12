import { NextResponse, type NextRequest } from "next/server"
import {
  handleUserNotesRpc,
  USER_NOTES_SERVER_INFO,
  USER_NOTES_PROTOCOL_VERSION,
  USER_NOTES_TOOLS,
} from "@/lib/mcp/user-notes-handler"

/**
 * MCP Server (JSON-RPC 2.0 over HTTP) — "user-notes".
 * Autenticação via header X-User-Id (ou X-User-ID). Para uso interno no mesmo
 * deploy, o lib/ai/mcp.ts prefere o transport in-memory e nem chega aqui.
 */

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id") ?? req.headers.get("x-user-ID")
  if (!userId) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Missing X-User-Id header" } },
      { status: 401 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 }
    )
  }

  if (body.id === undefined) {
    return new NextResponse(null, { status: 202 })
  }

  const response = await handleUserNotesRpc(body, userId)
  if (!response) return new NextResponse(null, { status: 202 })
  return NextResponse.json(response, { status: 200 })
}

export async function GET() {
  return NextResponse.json({
    server: USER_NOTES_SERVER_INFO,
    protocol: USER_NOTES_PROTOCOL_VERSION,
    tools: USER_NOTES_TOOLS.map((t) => t.name),
    hint: "This is a Streamable HTTP MCP server. POST JSON-RPC 2.0 requests with X-User-Id header.",
  })
}
