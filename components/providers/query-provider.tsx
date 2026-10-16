"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { conversationsKey, type ConversationSummary } from "@/lib/conversations/store"

export function QueryProvider({
  initialConversations,
  children,
}: {
  initialConversations: ConversationSummary[]
  children: React.ReactNode
}) {
  // Semeia o cache com a lista vinda do servidor; daqui pra frente o cliente
  // é dono do estado (mutações otimistas, refetch ao voltar pra aba).
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } },
    })
    c.setQueryData(conversationsKey, initialConversations)
    return c
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
