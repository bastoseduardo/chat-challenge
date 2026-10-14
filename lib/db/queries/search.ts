import { db } from "@/lib/db/client"
import { sql } from "drizzle-orm"
import { createServiceClient } from "@/lib/supabase/service"
import { embedDocument, toVectorLiteral } from "@/lib/ai/embeddings"

export interface SearchResult {
  messageId: string
  conversationId: string
  conversationTitle: string
  role: string
  content: unknown
  createdAt: string
  similarity: number
}

/** Gera embedding e persiste na mensagem (background-safe). */
export async function embedAndStoreMessage(messageId: string, text: string) {
  const vec = await embedDocument(text)
  if (!vec) return
  const literal = toVectorLiteral(vec)
  await db.execute(sql`
    UPDATE messages
    SET embedding = ${literal}::vector
    WHERE id = ${messageId}
  `)
}

/** Busca semântica cross-conversation. Usa service client pra chamar a função SQL. */
export async function semanticSearch(
  userId: string,
  queryEmbedding: number[],
  limit = 10
): Promise<SearchResult[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc("semantic_search_messages", {
    p_user_id: userId,
    p_query_embedding: toVectorLiteral(queryEmbedding),
    p_limit: limit,
  })
  if (error) {
    console.error("[search] rpc error:", error)
    return []
  }
  const rows = (data ?? []) as Array<{
    message_id: string
    conversation_id: string
    conversation_title: string
    role: string
    content: unknown
    created_at: string
    similarity: number
  }>
  return rows.map((r) => ({
    messageId: r.message_id,
    conversationId: r.conversation_id,
    conversationTitle: r.conversation_title,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
    similarity: r.similarity,
  }))
}

/** Extrai texto plano de um `content` jsonb (array de parts). */
export function extractPartsText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((p): p is { type: "text"; text: string } => {
      const o = p as { type?: string; text?: string }
      return o.type === "text" && typeof o.text === "string"
    })
    .map((p) => p.text)
    .join("\n")
}
