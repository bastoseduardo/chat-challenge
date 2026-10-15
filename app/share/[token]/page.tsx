export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { MessageBubble } from "@/components/chat/message-bubble"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    title: data.conversation.title,
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
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
        <span aria-hidden className="h-5 w-0.5 rounded-full bg-tool" />
        <h1 className="min-w-0 flex-1 truncate font-semibold">{conversation.title}</h1>
        <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
          Somente leitura
        </Badge>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/login">Entrar para conversar</Link>
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-7 px-4 py-6 sm:px-6">
          {conversation.compaction_count > 0 && (
            <p className="text-sm text-muted-foreground">
              As mensagens mais antigas desta conversa foram resumidas{" "}
              {conversation.compaction_count === 1
                ? "uma vez"
                : `${conversation.compaction_count} vezes`}{" "}
              pra caber no contexto do modelo.
            </p>
          )}
          {messages.length === 0 && (
            <p className="py-16 text-center text-muted-foreground">Esta conversa está vazia.</p>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <footer className="mt-12 border-t pt-6 text-sm text-muted-foreground">
            Conversa compartilhada em modo somente leitura. Pra fazer suas próprias perguntas,{" "}
            <Link href="/login" className="text-primary underline underline-offset-4">
              entre com sua conta
            </Link>
            .
          </footer>
        </div>
      </main>
    </div>
  )
}
