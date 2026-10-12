import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logAudit } from "@/lib/audit/log"

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/"

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      await logAudit({
        userId: data.user.id,
        eventType: "user.login",
        metadata: { provider: "google" },
        ipAddress: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      })
      return NextResponse.redirect(new URL(next, url.origin))
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth", url.origin))
}
