import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { isAdmin } from "@/lib/auth/admin"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!(await isAdmin({ id: user.id, email: user.email }))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const url = req.nextUrl
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50))
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
  const eventType = url.searchParams.get("event_type")
  const userId = url.searchParams.get("user_id")

  const service = createServiceClient()
  let query = service
    .from("audit_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (eventType) query = query.eq("event_type", eventType)
  if (userId) query = query.eq("user_id", userId)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data ?? [], total: count ?? 0, limit, offset })
}
