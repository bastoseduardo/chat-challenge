import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { attachments } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { createSignedDownloadUrl } from "@/lib/storage/attachments"

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

  const [row] = await db
    .select({ storagePath: attachments.storagePath })
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.userId, user.id)))
    .limit(1)
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const url = await createSignedDownloadUrl(row.storagePath)
  return NextResponse.json({ url })
}
