"use client"

import { useParams } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { useConversationTitle } from "@/lib/conversations/store"

// Componente cliente pra ler o título do cache: ao trocar de conversa só a
// coluna de mensagens mostra o esqueleto, o cabeçalho já aparece certo.
export default function ChatLoading() {
  const { id } = useParams<{ id: string }>()
  const title = useConversationTitle(id, "")

  return (
    <>
      <AppHeader
        title={
          title ? (
            <h1 className="truncate px-1 font-semibold">{title}</h1>
          ) : (
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          )
        }
      />
      <div className="flex-1 overflow-hidden" aria-busy="true" aria-label="Carregando a conversa">
        <div className="mx-auto max-w-3xl space-y-7 px-4 py-6 sm:px-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-7">
              <div className="flex justify-end">
                <div className="h-11 w-2/5 rounded-lg bg-muted animate-pulse" />
              </div>
              <div className="space-y-2.5">
                <div className="h-4 w-11/12 rounded bg-muted animate-pulse" />
                <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
                <div className="h-4 w-3/5 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
