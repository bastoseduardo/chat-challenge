// Voyage AI embeddings — voyage-3-lite retorna dim 512.
// Docs: https://docs.voyageai.com/reference/embeddings-api

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
const MODEL = "voyage-3-lite"
export const EMBEDDING_DIM = 512

interface VoyageResponse {
  object: "list"
  data: Array<{ object: "embedding"; embedding: number[]; index: number }>
  model: string
  usage: { total_tokens: number }
}

export class EmbeddingError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = "EmbeddingError"
  }
}

async function callVoyage(
  input: string[],
  type: "document" | "query"
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) throw new EmbeddingError("VOYAGE_API_KEY not configured")

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      input_type: type,
      output_dimension: EMBEDDING_DIM,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new EmbeddingError(`Voyage ${res.status}: ${text}`, res.status)
  }
  const json = (await res.json()) as VoyageResponse
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}

/** Vetoriza uma mensagem (document). Retorna null se falhar. */
export async function embedDocument(text: string): Promise<number[] | null> {
  const trimmed = text.trim().slice(0, 8000) // Voyage limita 32k tokens; margem segura em chars
  if (!trimmed) return null
  try {
    const [embedding] = await callVoyage([trimmed], "document")
    return embedding
  } catch (err) {
    console.error("[embeddings] embedDocument failed:", err)
    return null
  }
}

/** Vetoriza uma query do usuário. Levanta erro — o caller lida com fallback. */
export async function embedQuery(text: string): Promise<number[]> {
  const trimmed = text.trim().slice(0, 2000)
  if (!trimmed) throw new EmbeddingError("empty query")
  const [embedding] = await callVoyage([trimmed], "query")
  return embedding
}

/** Converte um array JS pra string literal pgvector `[0.1,0.2,...]`. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((n) => n.toFixed(6)).join(",")}]`
}
