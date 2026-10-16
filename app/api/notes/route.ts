import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createNote, encodeNotesCursor, listNotes } from "@/lib/db/queries/notes"
import { createNoteSchema, listNotesQuerySchema } from "@/lib/notes/schema"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"
import { logAudit } from "@/lib/audit/log"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"
import { getConversation } from "@/lib/db/queries/conversations"
import { and, eq } from "drizzle-orm"

/** A origem da nota (conversa e mensagem) precisa ser do próprio usuário. */
async function ownsOrigin(userId: string, conversationId?: string, messageId?: string) {
  if (messageId && !conversationId) return false
  if (!conversationId) return true
  if (!(await getConversation(conversationId, userId))) return false
  if (!messageId) return true
  const find = () =>
    db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
      .limit(1)
      .then((rows) => rows.length > 0)
  if (await find()) return true
  // Resposta recém-terminada (ex.: interrompida com "Parar") pode ainda estar
  // sendo gravada pelo onEnd do stream: uma nova tentativa curta.
  await new Promise((r) => setTimeout(r, 1500))
  return find()
}

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
  const last = notes[notes.length - 1]
  const nextCursor = notes.length === limit ? encodeNotesCursor(last) : null
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

  if (!(await ownsOrigin(user.id, parsed.data.conversationId, parsed.data.messageId))) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 400 })
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
