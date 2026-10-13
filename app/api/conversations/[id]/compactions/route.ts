import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { getConversation } from "@/lib/db/queries/conversations"

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

  const service = createServiceClient()
  const { data } = await service
    .from("audit_events")
    .select("created_at, metadata")
    .eq("event_type", "compaction.executed")
    .eq("resource_id", id)
    .order("created_at", { ascending: false })
    .limit(10)

  return NextResponse.json({
    totalInputTokens: conv.totalInputTokens,
    totalOutputTokens: conv.totalOutputTokens,
    compactionCount: conv.compactionCount,
    events: data ?? [],
  })
}
