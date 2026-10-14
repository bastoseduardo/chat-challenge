import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

// Config pra Vercel serverless + Supabase pooler:
// - prepare: false → requerido pelo PgBouncer transaction mode.
// - max: 1 → cada lambda abre no máximo 1 conexão; evita esgotar o pool
//   do Supabase (limite 15 no session mode; 200 no transaction mode).
// - idle_timeout → fecha conexões ociosas rápido pra devolver ao pool.
// - max_lifetime → reciclagem defensiva.
const queryClient = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
})

export const db = drizzle(queryClient, { schema })
export type DB = typeof db
