import { createNote, listNotes, searchNotes } from "@/lib/db/queries/notes"

export const USER_NOTES_SERVER_INFO = {
  name: "user-notes",
  title: "User Notes",
  version: "1.0.0",
}

export const USER_NOTES_PROTOCOL_VERSION = "2025-06-18"

export const USER_NOTES_TOOLS = [
  {
    name: "save_note",
    title: "Save Note",
    description:
      "Salva uma nota pessoal do usuário. Use para registrar fatos, decisões, lembretes.",
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
        limit: { type: "integer", description: "Número máximo de notas", default: 20 },
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

type JsonRpcMessage = {
  jsonrpc?: string
  id?: number | string | null
  method?: string
  params?: Record<string, unknown>
}

function textContent(text: string) {
  return { content: [{ type: "text", text }] }
}

export async function handleUserNotesRpc(
  message: JsonRpcMessage,
  userId: string
): Promise<{ jsonrpc: "2.0"; id: number | string; result: unknown } | { jsonrpc: "2.0"; id: number | string | null; error: { code: number; message: string } } | null> {
  // Notification (no id) → no response
  if (message.id === undefined || message.id === null) {
    return null
  }

  const method = message.method ?? ""
  const params = message.params

  try {
    const result = await route(method, params, userId)
    if (result === undefined) {
      return {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: `Method not found: ${method}` },
      }
    }
    return { jsonrpc: "2.0", id: message.id, result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "internal"
    console.error("[user-notes-handler]", err)
    return {
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32603, message: msg },
    }
  }
}

async function route(
  method: string,
  params: Record<string, unknown> | undefined,
  userId: string
): Promise<unknown> {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: USER_NOTES_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: USER_NOTES_SERVER_INFO,
        instructions:
          "Esse servidor armazena notas pessoais do usuário logado. Use save_note para registrar algo relevante, list_notes para ver o histórico e search_notes para encontrar algo específico.",
      }

    case "tools/list":
      return { tools: USER_NOTES_TOOLS }

    case "tools/call": {
      const name = (params as { name?: string } | undefined)?.name
      const args =
        (params as { arguments?: Record<string, unknown> } | undefined)?.arguments ?? {}

      if (name === "save_note") {
        const content = String(args.content ?? "").trim()
        if (!content) return textContent("Erro: conteúdo vazio")
        // Mesma tabela e embedding do Caderno: aparece em /caderno.
        const row = await createNote(userId, { content })
        return textContent(
          `Nota salva (id=${row.id.slice(0, 8)}, em ${row.createdAt.toISOString()})`
        )
      }

      if (name === "list_notes") {
        const limit = Math.min(50, Math.max(1, Number(args.limit ?? 20)))
        const rows = await listNotes({ userId, limit })
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
      return undefined
  }
}
