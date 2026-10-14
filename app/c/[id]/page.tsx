export const dynamic = "force-dynamic"

import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getConversation } from "@/lib/db/queries/conversations"
import { listMessagesWithAttachments } from "@/lib/db/queries/messages-with-attachments"
import { ChatView } from "@/components/chat/chat-view"

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ autostart?: string }>
}) {
  const { id } = await params
  const { autostart } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const conv = await getConversation(id, user.id)
  if (!conv) notFound()

  const initialMessages = await listMessagesWithAttachments(id)

  // Autostart é válido só se a última msg é user sem resposta — evita re-fire
  // em refresh posterior.
  const last = initialMessages[initialMessages.length - 1]
  const shouldAutostart =
    autostart === "1" && last?.role === "user" && initialMessages.length === 1

  return (
    <ChatView
      conversationId={conv.id}
      title={conv.title}
      compactionCount={conv.compactionCount}
      totalTokens={conv.totalInputTokens + conv.totalOutputTokens}
      model={conv.model}
      systemPrompt={conv.systemPrompt ?? null}
      initialMessages={initialMessages}
      autostart={shouldAutostart}
    />
  )
}
