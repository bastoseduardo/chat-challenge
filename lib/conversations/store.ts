"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

// Estado vivo da lista de conversas e do uso de contexto. O servidor entrega
// o estado inicial (layout RSC) e o cliente mantém atualizado — nenhuma
// mutação depende de router.refresh(). Ver docs/round-3/00-plan.md §3.

export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
}

export interface ConversationStats {
  totalTokens: number
  compactionCount: number
  events: CompactionEvent[]
}

export interface CompactionEvent {
  created_at: string
  metadata: {
    messages_summarized?: number
    tokens_before?: number
    forced?: boolean
  }
}

export const NEW_CONVERSATION_TITLE = "Nova conversa"
export const CONTEXT_WINDOW = 200_000
export const COMPACTION_THRESHOLD = 0.8

export const conversationsKey = ["conversations"] as const

/**
 * Sem sessão, o proxy responde /api/* com 307 pra /login e o fetch segue o
 * redirect até um 200 em HTML. Redirect conta como falha, senão uma sessão
 * expirada faria a UI otimista "confirmar" ações que não aconteceram.
 */
export function succeeded(res: Response | null | undefined): res is Response {
  return !!res && res.ok && !res.redirected
}
export const statsKey = (id: string) => ["conversation-stats", id] as const

async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await fetch("/api/conversations")
  if (!succeeded(res)) throw new Error("Falha ao carregar conversas")
  const data = (await res.json()) as { conversations: ConversationSummary[] }
  return data.conversations.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
}

export function useConversations() {
  return useQuery({ queryKey: conversationsKey, queryFn: fetchConversations })
}

export function useConversationTitle(id: string, fallback: string) {
  const { data } = useConversations()
  return data?.find((c) => c.id === id)?.title ?? fallback
}

function getList(client: QueryClient) {
  return client.getQueryData<ConversationSummary[]>(conversationsKey) ?? []
}

function setList(client: QueryClient, list: ConversationSummary[]) {
  client.setQueryData<ConversationSummary[]>(conversationsKey, list)
}

/** Operações locais no cache da lista. Não fazem request. */
export function useConversationCache() {
  const client = useQueryClient()

  const upsertTop = useCallback(
    (conv: ConversationSummary) => {
      setList(client, [conv, ...getList(client).filter((c) => c.id !== conv.id)])
    },
    [client]
  )

  const setTitle = useCallback(
    (id: string, title: string) => {
      setList(client, getList(client).map((c) => (c.id === id ? { ...c, title } : c)))
    },
    [client]
  )

  const touch = useCallback(
    (id: string) => {
      const found = getList(client).find((c) => c.id === id)
      if (found) upsertTop({ ...found, updatedAt: new Date().toISOString() })
    },
    [client, upsertTop]
  )

  const addUsage = useCallback(
    (id: string, tokens: number) => {
      client.setQueryData<ConversationStats>(statsKey(id), (old) =>
        old ? { ...old, totalTokens: old.totalTokens + tokens } : old
      )
    },
    [client]
  )

  return { upsertTop, setTitle, touch, addUsage }
}

/** Renomear e apagar com atualização otimista; apagar oferece desfazer. */
export function useConversationActions() {
  const client = useQueryClient()

  const rename = useCallback(
    async (id: string, title: string) => {
      const before = getList(client)
      setList(client, before.map((c) => (c.id === id ? { ...c, title } : c)))
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      }).catch(() => null)
      if (!succeeded(res)) {
        setList(client, before)
        toast.error("Não foi possível renomear. Tente de novo.")
      }
    },
    [client]
  )

  const restore = useCallback(
    async (conv: ConversationSummary, index: number) => {
      const list = getList(client).filter((c) => c.id !== conv.id)
      list.splice(Math.min(index, list.length), 0, conv)
      setList(client, list)
      const res = await fetch(`/api/conversations/${conv.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ restore: true }),
      }).catch(() => null)
      if (!succeeded(res)) {
        setList(client, getList(client).filter((c) => c.id !== conv.id))
        toast.error("Não foi possível restaurar a conversa.")
      }
    },
    [client]
  )

  const remove = useCallback(
    async (id: string) => {
      const before = getList(client)
      const index = before.findIndex((c) => c.id === id)
      const conv = before[index]
      if (!conv) return
      setList(client, before.filter((c) => c.id !== id))
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" }).catch(() => null)
      if (!succeeded(res)) {
        setList(client, before)
        toast.error("Não foi possível apagar. Tente de novo.")
        return
      }
      toast("Conversa apagada", {
        duration: 6000,
        action: { label: "Desfazer", onClick: () => void restore(conv, index) },
      })
    },
    [client, restore]
  )

  return { rename, remove }
}
