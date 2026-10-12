import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/audit/log"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  await supabase.auth.signOut()
  if (user) {
    await logAudit({ userId: user.id, eventType: "user.logout" })
  }
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin))
}
