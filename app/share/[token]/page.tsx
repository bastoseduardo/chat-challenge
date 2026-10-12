export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/service"
import { MessageBubble } from "@/components/chat/message-bubble"
import type { UIMessage } from "ai"
import { Badge } from "@/components/ui/badge"

interface SharedData {
  conversation: {
    id: string
    title: string
    created_at: string
    compaction_count: number
  }
  messages: Array<{
    id: string
    role: string
    content: unknown
    is_summary: boolean
    created_at: string
  }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await loadShared(token)
  if (!data) return { title: "Compartilhamento não encontrado" }
  return {
    title: `${data.conversation.title} · Chat Challenge`,
    description: "Conversa compartilhada em modo somente leitura",
  }
}

async function loadShared(token: string): Promise<SharedData | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.rpc("get_shared_conversation", { p_token: token })
  return (data as SharedData) ?? null
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await loadShared(token)
  if (!data) notFound()

  const messages: UIMessage[] = data.messages
    .filter((m) => !m.is_summary)
    .map((m) => ({
      id: m.id,
      role: m.role as UIMessage["role"],
      parts: (Array.isArray(m.content) ? m.content : []) as UIMessage["parts"],
    }))

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold">{data.conversation.title}</h1>
          <Badge variant="outline">Somente leitura</Badge>
          {data.conversation.compaction_count > 0 && (
            <Badge variant="secondary">
              Comprimido {data.conversation.compaction_count}x
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
