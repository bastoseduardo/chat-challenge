export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getConversation } from "@/lib/db/queries/conversations"
import { listMessagesWithAttachments } from "@/lib/db/queries/messages-with-attachments"
import { ChatView } from "@/components/chat/chat-view"

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

  const initialMessages = await listMessagesWithAttachments(id)

  return (
    <ChatView
      conversationId={conv.id}
      title={conv.title}
      compactionCount={conv.compactionCount}
      totalTokens={conv.totalInputTokens + conv.totalOutputTokens}
      model={conv.model}
      systemPrompt={conv.systemPrompt ?? null}
      initialMessages={initialMessages}
    />
  )
}
