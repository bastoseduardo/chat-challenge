import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  getConversation,
  listMessages,
  renameConversation,
  softDeleteConversation,
} from "@/lib/db/queries/conversations"
import { logAudit } from "@/lib/audit/log"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const conv = await getConversation(id, user.id)
  if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const msgs = await listMessages(id)
  return NextResponse.json({ conversation: conv, messages: msgs })
}

const patchSchema = z.object({ title: z.string().min(1).max(140) })

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  await renameConversation(id, user.id, parsed.data.title)
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  await softDeleteConversation(id, user.id)
  await logAudit({
    userId: user.id,
    eventType: "conversation.deleted",
    resourceType: "conversation",
    resourceId: id,
  })
  return NextResponse.json({ ok: true })
}
