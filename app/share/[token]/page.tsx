export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { MessageBubble } from "@/components/chat/message-bubble"
import { Badge } from "@/components/ui/badge"
import { loadSharedConversation } from "@/lib/db/queries/shared-conversation"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await loadSharedConversation(token)
  if (!data) return { title: "Compartilhamento não encontrado" }
  return {
    title: `${data.conversation.title} · Chat Challenge`,
    description: "Conversa compartilhada em modo somente leitura",
  }
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await loadSharedConversation(token)
  if (!data) notFound()

  const { conversation, messages } = data

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <header className="border-b px-6 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold">{conversation.title}</h1>
          <Badge variant="outline">Somente leitura</Badge>
          {conversation.compaction_count > 0 && (
            <Badge variant="secondary">
              Comprimido {conversation.compaction_count}x
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">Chat Challenge</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <p className="text-center text-muted-foreground py-16">
              Esta conversa está vazia.
            </p>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </div>
      </div>
    </div>
  )
}
