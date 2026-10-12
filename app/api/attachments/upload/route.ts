import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createSignedUploadUrl, detectKind, ATTACHMENT_LIMITS } from "@/lib/storage/attachments"
import { db } from "@/lib/db/client"
import { conversations } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  originalName: z.string().min(1).max(512),
})

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 })
  }
  const { conversationId, mimeType, sizeBytes, originalName } = parsed.data

  const kind = detectKind(mimeType)
  if (!kind) return NextResponse.json({ error: "unsupported_type" }, { status: 400 })

  const limit = ATTACHMENT_LIMITS[kind].maxBytes
  if (sizeBytes > limit) {
    return NextResponse.json(
      { error: "too_large", limit, received: sizeBytes },
      { status: 400 }
    )
  }

  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, user.id)))
    .limit(1)
  if (!conv) return NextResponse.json({ error: "conversation_not_found" }, { status: 404 })

  const { path, signedUrl, token } = await createSignedUploadUrl({
    userId: user.id,
    conversationId,
    mimeType,
    filename: originalName,
  })

  // The attachments row is created at /api/chat time, when message_id is known.
  return NextResponse.json({
    signedUrl,
    token,
    storagePath: path,
    kind,
    mimeType,
    sizeBytes,
    originalName,
  })
}
