import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNote, listNotes } from "@/lib/db/queries/notes"
import { createNoteSchema, listNotesQuerySchema } from "@/lib/notes/schema"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"
import { logAudit } from "@/lib/audit/log"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = listNotesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const { limit, cursor, conversationId } = parsed.data
  const notes = await listNotes({ userId: user.id, limit, cursor, conversationId })
  const nextCursor = notes.length === limit ? notes[notes.length - 1].createdAt.toISOString() : null
  return NextResponse.json({ notes, nextCursor })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    await assertRateLimit({ key: `notes:${user.id}`, limit: 30, windowMs: 60_000 })
  } catch (err) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: err.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSec) } }
      )
    }
    throw err
  }

  const parsed = createNoteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 })
  }

  const note = await createNote(user.id, parsed.data)
  await logAudit({
    userId: user.id,
    eventType: "note.created",
    resourceType: "note",
    resourceId: note.id,
    metadata: { has_quote: !!note.quote, has_source: !!(note.sourceUrl || note.sourceTitle) },
  })
  return NextResponse.json({ note })
}
