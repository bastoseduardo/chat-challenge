import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  createConversation,
  listConversations,
} from "@/lib/db/queries/conversations"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"
import { logAudit } from "@/lib/audit/log"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const rows = await listConversations(user.id)
  return NextResponse.json({ conversations: rows })
}

const postSchema = z
  .object({ firstMessage: z.string().min(1).max(50_000).optional() })
  .optional()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let firstMessage: string | undefined
  try {
    const raw = await req.text()
    if (raw) {
      const parsed = postSchema.safeParse(JSON.parse(raw))
      firstMessage = parsed.success ? parsed.data?.firstMessage : undefined
    }
  } catch {
    // ignora body malformado — segue sem firstMessage
  }

  const row = await createConversation(user.id)

  if (firstMessage?.trim()) {
    // Pre-gera o UUID e usa como id + clientMessageId. Quando o cliente chamar
    // regenerate() depois, o /api/chat recebe clientMessageId = esse mesmo id
    // (vem do UIMessage.id, que = row.id em listMessagesWithAttachments), e o
    // ON CONFLICT por (conversation_id, client_message_id) evita duplicação.
    const msgId = crypto.randomUUID()
    await db.insert(messages).values({
      id: msgId,
      conversationId: row.id,
      clientMessageId: msgId,
      role: "user",
      content: [{ type: "text", text: firstMessage.trim() }] as unknown as object,
    })
    await logAudit({
      userId: user.id,
      eventType: "message.sent",
      resourceType: "conversation",
      resourceId: row.id,
      metadata: { parts: 1, attachments: 0, source: "new_chat_staging" },
    })
  }

  await logAudit({
    userId: user.id,
    eventType: "conversation.created",
    resourceType: "conversation",
    resourceId: row.id,
    metadata: { title: row.title, withFirstMessage: !!firstMessage },
  })

  return NextResponse.json({ conversation: row })
}
