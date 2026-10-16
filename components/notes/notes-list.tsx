"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, NotebookPen, Search, X } from "lucide-react"
import { useConversationTitle } from "@/lib/conversations/store"
import { useNotes, useNotesSearch } from "@/lib/notes/store"
import { NoteItem } from "./note-item"

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function NotesList() {
  const params = useSearchParams()
  const conversationId = params.get("conversationId") ?? undefined
  const convTitle = useConversationTitle(conversationId ?? "", "esta conversa")
  const [query, setQuery] = useState("")
  const q = useDebounced(query.trim(), 250)

  const list = useNotes(conversationId)
  const search = useNotesSearch(q)
  const searching = q.length >= 2
  // Enquanto a busca no servidor (texto + significado) não volta, filtra na
  // hora as notas já carregadas pelo texto digitado.
  const local = useMemo(() => {
    if (!searching || !list.data) return undefined
    const needle = q.toLocaleLowerCase("pt-BR")
    return list.data.filter((n) =>
      [n.title, n.quote, n.content].some((f) => f?.toLocaleLowerCase("pt-BR").includes(needle))
    )
  }, [searching, q, list.data])
  const notes = searching ? (search.data ?? local) : list.data
  const loading = searching ? search.isFetching && !search.data && !local?.length : list.isLoading
  const error = searching ? search.error : list.error

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="notes-search" className="sr-only">
          Buscar no caderno
        </label>
        <input
          id="notes-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por palavra ou assunto"
          className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground"
        />
      </div>

      {conversationId && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          Notas de <span className="font-medium text-foreground">{convTitle}</span>
          <Link href="/caderno" className="inline-flex items-center gap-1 text-primary hover:underline">
            <X className="size-3.5" aria-hidden />
            Mostrar todas
          </Link>
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {notes ? `${notes.length} ${notes.length === 1 ? "nota" : "notas"}` : ""}
      </p>

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {searching ? "Procurando…" : "Carregando o caderno…"}
        </p>
      )}

      {error && !loading && (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2.5 text-sm">
          {(error as Error).message}
        </p>
      )}

      {notes && notes.length === 0 && !loading && (
        searching ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma nota encontrada pra “{q}”.</p>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <NotebookPen className="size-8 text-tool" aria-hidden />
            <p className="max-w-sm text-muted-foreground">
              Guarde trechos das respostas selecionando o texto. Eles aparecem aqui, com a fonte.
            </p>
          </div>
        )
      )}

      {notes && notes.length > 0 && (
        <ul className="space-y-3">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} />
          ))}
        </ul>
      )}
    </div>
  )
}
