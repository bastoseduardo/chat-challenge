/**
 * Gera o embedding das notas que ainda não têm (notas criadas antes da
 * migração 0004, ou cujo embedding falhou). Sem ele, a nota não aparece na
 * busca por significado nem volta como contexto (SPEC-R4-006). Idempotente.
 *
 *   npx tsx scripts/backfill-note-embeddings.ts
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file)
  if (existsSync(path)) config({ path, override: false })
}

async function main() {
  const { db } = await import("@/lib/db/client")
  const { userNotes } = await import("@/lib/db/schema")
  const { embedDocument, toVectorLiteral } = await import("@/lib/ai/embeddings")
  const { and, eq, isNull, sql } = await import("drizzle-orm")

  const rows = await db
    .select({ id: userNotes.id, title: userNotes.title, quote: userNotes.quote, content: userNotes.content })
    .from(userNotes)
    .where(and(isNull(userNotes.embedding), isNull(userNotes.deletedAt)))

  let done = 0
  for (const n of rows) {
    const text = [n.title, n.quote, n.content].filter((s) => s?.trim()).join("\n\n")
    const vec = text ? await embedDocument(text) : null
    if (!vec) continue
    await db
      .update(userNotes)
      .set({ embedding: sql`${toVectorLiteral(vec)}::vector` })
      .where(eq(userNotes.id, n.id))
    done++
  }
  console.log(`embeddings gerados: ${done} de ${rows.length}`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
