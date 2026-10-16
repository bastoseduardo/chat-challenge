import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getNote, restoreNote, softDeleteNote, updateNote } from "@/lib/db/queries/notes"
import { updateNoteSchema } from "@/lib/notes/schema"
import { logAudit } from "@/lib/audit/log"

const idSchema = z.string().uuid()

async function auth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const note = await getNote(user.id, id)
  if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ note })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const parsed = updateNoteSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const { restore, ...patch } = parsed.data
  if (restore && !(await restoreNote(user.id, id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  if (patch.content !== undefined || patch.title !== undefined) {
    const note = await updateNote(user.id, id, patch)
    if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await ctx.params
  if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "not_found" }, { status: 404 })

  if (!(await softDeleteNote(user.id, id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }
  await logAudit({ userId: user.id, eventType: "note.deleted", resourceType: "note", resourceId: id })
  return NextResponse.json({ ok: true })
}
