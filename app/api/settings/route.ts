import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { userSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

const patchSchema = z.object({
  enabledTools: z.array(z.string()).optional(),
  mcpConfig: z.record(z.string(), z.unknown()).optional(),
})

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = patchSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (parsed.data.enabledTools) update.enabledTools = parsed.data.enabledTools
  if (parsed.data.mcpConfig) update.mcpConfig = parsed.data.mcpConfig

  await db
    .insert(userSettings)
    .values({ userId: user.id, ...update })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: update,
    })

  return NextResponse.json({ ok: true })
}
