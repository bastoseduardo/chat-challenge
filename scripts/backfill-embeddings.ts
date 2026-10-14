/**
 * Gera embeddings pras mensagens que ainda não têm.
 *
 * Uso: npx tsx scripts/backfill-embeddings.ts
 *
 * - Lê .env.local automaticamente.
 * - Pula summaries e mensagens vazias.
 * - Processa em batches de 32 (Voyage aceita até 128, 32 é safe pra timeout).
 * - Idempotente: só processa WHERE embedding IS NULL.
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"

for (const file of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), file)
  if (existsSync(p)) config({ path: p, override: false })
}

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings"
const MODEL = "voyage-3-lite"
const DIM = 512
const BATCH_SIZE = 32

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return (content as Array<{ type?: string; text?: string }>)
    .filter((p) => p?.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim()
    .slice(0, 8000)
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((n) => n.toFixed(6)).join(",")}]`
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY
  if (!key) throw new Error("VOYAGE_API_KEY not set")
  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      input: texts,
      input_type: "document",
      output_dimension: DIM,
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Voyage ${res.status}: ${body}`)
  }
  const json = (await res.json()) as VoyageResponse
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

async function main() {
  // Prefere o pooler (DATABASE_URL) — o DNS direto `db.*.supabase.co` foi
  // deprecado no Supabase e já não resolve em muitos projetos.
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (!url) throw new Error("DATABASE_URL or DIRECT_URL not set")

  const sql = postgres(url, { prepare: false })

  console.log("🔍 Buscando mensagens sem embedding...")
  const rows = (await sql`
    SELECT id, content
    FROM messages
    WHERE embedding IS NULL
      AND is_summary = false
    ORDER BY created_at ASC
  `) as Array<{ id: string; content: unknown }>

  const pending = rows
    .map((r) => ({ id: r.id, text: extractText(r.content) }))
    .filter((r) => r.text.length > 0)

  if (pending.length === 0) {
    console.log("✅ Nada a fazer — todas as mensagens já têm embedding.")
    await sql.end()
    return
  }

  console.log(`📝 ${pending.length} mensagem(ns) para processar.`)
  const skipped = rows.length - pending.length
  if (skipped > 0) console.log(`   (${skipped} vazia(s) ignorada(s))`)

  let done = 0
  let failed = 0
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE)
    try {
      const embeddings = await embedBatch(batch.map((b) => b.text))
      // UPDATE em paralelo (postgres-js enfileira)
      await Promise.all(
        batch.map((b, idx) => {
          const literal = toVectorLiteral(embeddings[idx])
          return sql`UPDATE messages SET embedding = ${literal}::vector WHERE id = ${b.id}`
        })
      )
      done += batch.length
      const pct = Math.round((done / pending.length) * 100)
      console.log(`   [${pct.toString().padStart(3)}%] ${done}/${pending.length}`)
    } catch (err) {
      failed += batch.length
      console.error(
        `   ❌ batch ${i}-${i + batch.length} falhou:`,
        err instanceof Error ? err.message : err
      )
      // segue a vida
    }
    // Rate limit cortesia (Voyage free: 3 req/s)
    await new Promise((r) => setTimeout(r, 350))
  }

  await sql.end()
  console.log("")
  console.log(`✅ Concluído. ${done} com sucesso, ${failed} falha(s).`)
}

main().catch((err) => {
  console.error("💥 Fatal:", err)
  process.exit(1)
})
