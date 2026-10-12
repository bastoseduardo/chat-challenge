export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createConversation } from "@/lib/db/queries/conversations"
import { logAudit } from "@/lib/audit/log"

export default async function NewChatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const conv = await createConversation(user.id)
  await logAudit({
    userId: user.id,
    eventType: "conversation.created",
    resourceType: "conversation",
    resourceId: conv.id,
  })
  redirect(`/c/${conv.id}`)
}
