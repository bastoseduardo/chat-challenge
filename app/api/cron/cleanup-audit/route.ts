import { NextResponse, type NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Vercel Cron — roda diariamente, deleta eventos de audit com mais de 90 dias.
 * Protegido pelo header `authorization: Bearer <CRON_SECRET>` que o Vercel injeta.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")
  const expected = process.env.CRON_SECRET
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const retentionDays = Number(process.env.AUDIT_RETENTION_DAYS) || 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  const service = createServiceClient()
  const { count, error } = await service
    .from("audit_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString())

  if (error) {
    console.error("[cron/cleanup-audit]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    deleted: count ?? 0,
    retention_days: retentionDays,
    cutoff: cutoff.toISOString(),
  })
}
