export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  getConversation,
  listMessages,
} from "@/lib/db/queries/conversations"
import { ChatView } from "@/components/chat/chat-view"
import type { UIMessage } from "ai"

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const conv = await getConversation(id, user.id)
  if (!conv) notFound()

  const rows = await listMessages(id)
  const initialMessages: UIMessage[] = rows
    .filter((r) => !r.isSummary)
    .map((r) => ({
      id: r.id,
      role: r.role as UIMessage["role"],
      parts: (Array.isArray(r.content) ? r.content : []) as UIMessage["parts"],
    }))

  return (
    <ChatView
      conversationId={conv.id}
      title={conv.title}
      compactionCount={conv.compactionCount}
      initialMessages={initialMessages}
    />
  )
}
