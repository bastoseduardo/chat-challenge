import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  getConversation,
  listMessages,
  restoreConversation,
  softDeleteConversation,
  updateConversation,
} from "@/lib/db/queries/conversations"
import { logAudit } from "@/lib/audit/log"
import { MODELS } from "@/lib/ai/pricing"

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

const patchSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  model: z.string().optional(),
  systemPrompt: z.string().max(10_000).nullable().optional(),
  // Desfaz um soft delete (toast "Desfazer" na sidebar).
  restore: z.literal(true).optional(),
})

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

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  // valida modelo
  if (parsed.data.model && !MODELS.some((m) => m.id === parsed.data.model)) {
    return NextResponse.json({ error: "invalid_model" }, { status: 400 })
  }

  const { restore, ...patch } = parsed.data
  if (restore) {
    await restoreConversation(id, user.id)
    await logAudit({
      userId: user.id,
      eventType: "conversation.restored",
      resourceType: "conversation",
      resourceId: id,
    })
  }
  if (Object.keys(patch).length > 0) await updateConversation(id, user.id, patch)
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
