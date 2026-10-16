"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { succeeded } from "@/lib/conversations/store"
import type { CreateNoteInput } from "@/lib/notes/schema"
import { markTour } from "@/lib/demo/tour"

// Caderno no cliente (SPEC-R4-005): mesmo padrão da lista de conversas —
// cache do React Query, mutações otimistas, apagar com "Desfazer".

export interface NoteDTO {
  id: string
  content: string
  title: string | null
  quote: string | null
  sourceUrl: string | null
  sourceTitle: string | null
  sourcePage: number | null
  conversationId: string | null
  messageId: string | null
  createdAt: string
  updatedAt: string
}

export const notesKey = (conversationId?: string) => ["notes", conversationId ?? "all"] as const
export const notesSearchKey = (q: string) => ["notes-search", q] as const

async function fetchNotes(conversationId?: string): Promise<NoteDTO[]> {
  const qs = new URLSearchParams({ limit: "100" })
  if (conversationId) qs.set("conversationId", conversationId)
  const res = await fetch(`/api/notes?${qs}`)
  if (!succeeded(res)) throw new Error("Não foi possível carregar o caderno.")
  return (await res.json()).notes
}

export async function searchNotesApi(q: string, signal?: AbortSignal): Promise<NoteDTO[]> {
  const res = await fetch(`/api/notes/search?q=${encodeURIComponent(q)}`, { signal })
  if (!succeeded(res)) throw new Error("A busca no caderno não está disponível agora.")
  return (await res.json()).notes
}

export function useNotes(conversationId?: string) {
  return useQuery({ queryKey: notesKey(conversationId), queryFn: () => fetchNotes(conversationId) })
}

export function useNotesSearch(q: string) {
  return useQuery({
    queryKey: notesSearchKey(q),
    queryFn: ({ signal }) => searchNotesApi(q, signal),
    enabled: q.length >= 2,
    staleTime: 30_000,
  })
}

/** Aplica `fn` em todas as listas de notas em cache (todas e por conversa). */
function updateAllLists(client: QueryClient, fn: (list: NoteDTO[]) => NoteDTO[]) {
  for (const [key, data] of client.getQueriesData<NoteDTO[]>({ queryKey: ["notes"] })) {
    if (data) client.setQueryData(key, fn(data))
  }
}

export function useNoteActions() {
  const client = useQueryClient()
  const router = useRouter()

  const create = useCallback(
    async (input: CreateNoteInput) => {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }).catch(() => null)
      if (!succeeded(res)) {
        toast.error("Não foi possível guardar no caderno. Tente de novo.")
        return null
      }
      const { note } = (await res.json()) as { note: NoteDTO }
      updateAllLists(client, (list) => [note, ...list])
      void client.invalidateQueries({ queryKey: ["notes-search"] })
      markTour("note")
      toast.success("Guardado no caderno", {
        action: { label: "Abrir", onClick: () => router.push("/caderno") },
      })
      return note
    },
    [client, router]
  )

  const update = useCallback(
    async (id: string, patch: { content?: string; title?: string | null }) => {
      const snapshot = client.getQueriesData<NoteDTO[]>({ queryKey: ["notes"] })
      updateAllLists(client, (list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)))
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => null)
      if (!succeeded(res)) {
        for (const [key, data] of snapshot) client.setQueryData(key, data)
        toast.error("Não foi possível salvar a nota. Tente de novo.")
        return false
      }
      return true
    },
    [client]
  )

  const remove = useCallback(
    async (note: NoteDTO) => {
      const snapshot = client.getQueriesData<NoteDTO[]>({ queryKey: ["notes"] })
      updateAllLists(client, (list) => list.filter((n) => n.id !== note.id))
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" }).catch(() => null)
      if (!succeeded(res)) {
        for (const [key, data] of snapshot) client.setQueryData(key, data)
        toast.error("Não foi possível apagar a nota. Tente de novo.")
        return
      }
      toast("Nota apagada", {
        duration: 6000,
        action: {
          label: "Desfazer",
          onClick: async () => {
            for (const [key, data] of snapshot) client.setQueryData(key, data)
            const r = await fetch(`/api/notes/${note.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ restore: true }),
            }).catch(() => null)
            if (!succeeded(r)) {
              updateAllLists(client, (list) => list.filter((n) => n.id !== note.id))
              toast.error("Não foi possível restaurar a nota.")
            }
          },
        },
      })
    },
    [client]
  )

  return { create, update, remove }
}
