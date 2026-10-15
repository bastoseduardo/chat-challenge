import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  createConversationWithId,
  listConversations,
} from "@/lib/db/queries/conversations"
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

// O id é gerado no cliente (tela de nova conversa) pra que a UI não precise
// navegar nem esperar o servidor pra saber o id. A criação é idempotente:
// reenviar o mesmo id devolve a mesma conversa.
const postSchema = z.object({ id: z.string().uuid() })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const result = await createConversationWithId(parsed.data.id, user.id)
  if (!result) return NextResponse.json({ error: "conflict" }, { status: 409 })

  if (result.created) {
    await logAudit({
      userId: user.id,
      eventType: "conversation.created",
      resourceType: "conversation",
      resourceId: result.row.id,
      metadata: { title: result.row.title },
    })
  }

  return NextResponse.json({ conversation: result.row })
}
