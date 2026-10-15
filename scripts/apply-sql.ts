/**
 * Aplica um arquivo .sql no banco (DIRECT_URL) numa transação.
 *
 *   npx tsx scripts/apply-sql.ts drizzle/migrations/0004_caderno_notes.sql
 *
 * Usado pras migrações do Round 4, escritas à mão e idempotentes: o journal do
 * drizzle-kit parou na 0002 (a 0003 já foi manual), então `db:generate` está
 * fora de sincronia com o banco. Ver docs/round-4/tasks.md, convenção 4.
 */
import { config } from "dotenv"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file)
  if (existsSync(path)) config({ path, override: false })
}

import postgres from "postgres"

async function main() {
  const file = process.argv[2]
  if (!file) throw new Error("uso: npx tsx scripts/apply-sql.ts <arquivo.sql>")
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error("DIRECT_URL não definida")
  const text = readFileSync(resolve(process.cwd(), file), "utf8")

  const client = postgres(url, { max: 1, prepare: false })
  try {
    await client.begin(async (tx) => {
      await tx.unsafe(text)
    })
    console.log(`aplicado: ${file}`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
