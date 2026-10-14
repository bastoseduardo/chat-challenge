import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { embedQuery } from "@/lib/ai/embeddings"
import { extractPartsText, semanticSearch } from "@/lib/db/queries/search"
import { assertRateLimit, RateLimitError, getClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const ip = getClientIp(req)
  try {
    await assertRateLimit({ key: `search:${ip}`, limit: 30, windowMs: 60_000 })
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: err.retryAfterSec },
        { status: 429 }
      )
    }
    throw err
  }

  let embedding: number[]
  try {
    embedding = await embedQuery(q)
  } catch (err) {
    console.error("[search] embed query failed:", err)
    return NextResponse.json({ error: "embedding_failed" }, { status: 500 })
  }

  const results = await semanticSearch(user.id, embedding, 10)

  return NextResponse.json({
    query: q,
    results: results.map((r) => ({
      messageId: r.messageId,
      conversationId: r.conversationId,
      conversationTitle: r.conversationTitle,
      role: r.role,
      preview: extractPartsText(r.content).slice(0, 200),
      createdAt: r.createdAt,
      similarity: Math.round(r.similarity * 100),
    })),
  })
}
