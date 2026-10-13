import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getConversation } from "@/lib/db/queries/conversations"
import { compactIfNeeded } from "@/lib/ai/compaction"
import { DEFAULT_MODEL } from "@/lib/ai/pricing"

export const maxDuration = 60

export async function POST(
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

  const result = await compactIfNeeded({
    conversationId: id,
    userId: user.id,
    model: conv.model || DEFAULT_MODEL,
    force: true,
  })

  return NextResponse.json(result)
}
