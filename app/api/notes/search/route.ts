import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { searchNotes } from "@/lib/db/queries/notes"
import { searchNotesQuerySchema } from "@/lib/notes/schema"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  // Cada busca gera um embedding (Voyage). A UI busca com debounce de 250 ms.
  try {
    await assertRateLimit({ key: `notes-search:${user.id}`, limit: 60, windowMs: 60_000 })
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: err.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSec) } }
      )
    }
    throw err
  }

  const parsed = searchNotesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const notes = await searchNotes(user.id, parsed.data.q)
  return NextResponse.json({ notes })
}
