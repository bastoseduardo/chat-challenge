import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createConversation,
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

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const row = await createConversation(user.id)
  await logAudit({
    userId: user.id,
    eventType: "conversation.created",
    resourceType: "conversation",
    resourceId: row.id,
    metadata: { title: row.title },
  })
  return NextResponse.json({ conversation: row })
}
