import { db } from "@/lib/db/client"
import { rateLimitBuckets } from "@/lib/db/schema"
import { sql } from "drizzle-orm"
import type { NextRequest } from "next/server"

export class RateLimitError extends Error {
  constructor(
    public key: string,
    public limit: number,
    public retryAfterSec: number
  ) {
    super(`Rate limit exceeded for ${key} (${limit}/window)`)
  }
}

/**
 * Fixed-window rate limit sem race condition grave:
 * ON CONFLICT atômico, 1 roundtrip.
 */
export async function assertRateLimit(opts: {
  key: string
  limit: number
  windowMs: number
}): Promise<void> {
  const { key, limit, windowMs } = opts

  // Faz UPSERT: se bucket é novo ou expirou → reset; senão → increment
  const rows = await db.execute(sql`
    insert into ${rateLimitBuckets} (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      window_start = case
        when ${rateLimitBuckets.windowStart} + make_interval(secs => ${windowMs / 1000}) < now()
          then now()
        else ${rateLimitBuckets.windowStart}
      end,
      count = case
        when ${rateLimitBuckets.windowStart} + make_interval(secs => ${windowMs / 1000}) < now()
          then 1
        else ${rateLimitBuckets.count} + 1
      end
    returning window_start, count
  `)

  // postgres-js devolve as linhas como array (o node-postgres usa `.rows`).
  // Ler só `.rows` deixava o limite sempre aberto.
  type Bucket = { window_start: string | Date; count: number | string }
  const list = (Array.isArray(rows) ? rows : (rows as unknown as { rows?: Bucket[] }).rows) as Bucket[] | undefined
  const row = list?.[0]
  if (!row) return // fallback: não bloqueia se não deu pra ler

  if (Number(row.count) > limit) {
    const windowStart = new Date(row.window_start).getTime()
    const retryAfterMs = Math.max(0, windowStart + windowMs - Date.now())
    throw new RateLimitError(key, limit, Math.ceil(retryAfterMs / 1000))
  }
}

export function getClientIp(req: NextRequest | Request): string {
  const headers = "headers" in req ? req.headers : (req as Request).headers
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0].trim()
    if (first) return first
  }
  return headers.get("x-real-ip") ?? "unknown"
}
