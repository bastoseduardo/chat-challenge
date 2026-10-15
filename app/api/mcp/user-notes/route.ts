import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  handleUserNotesRpc,
  USER_NOTES_SERVER_INFO,
  USER_NOTES_PROTOCOL_VERSION,
  USER_NOTES_TOOLS,
} from "@/lib/mcp/user-notes-handler"

/**
 * MCP Server (JSON-RPC 2.0 over HTTP) — "user-notes".
 * O usuário vem da sessão (cookie do Supabase). O header X-User-Id era aceito
 * sem verificação e permitia ler/gravar notas de outra conta; agora, se vier,
 * precisa ser o próprio usuário logado. Para uso interno no mesmo deploy, o
 * lib/ai/mcp.ts usa o transport in-memory e nem chega aqui.
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized" } },
      { status: 401 }
    )
  }
  const headerUserId = req.headers.get("x-user-id")
  if (headerUserId && headerUserId !== user.id) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32003, message: "Forbidden" } },
      { status: 403 }
    )
  }
  const userId = user.id

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
    hint: "This is a Streamable HTTP MCP server. POST JSON-RPC 2.0 requests with an authenticated session.",
  })
}
