"use client"

import Link from "next/link"
import { useState } from "react"
import { ExternalLink, MessageSquare, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/chat/markdown"
import { useConversationTitle } from "@/lib/conversations/store"
import { useNoteActions, type NoteDTO } from "@/lib/notes/store"

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" })

function sourceText(n: NoteDTO): string | null {
  if (!n.sourceUrl && !n.sourceTitle) return null
  let base = n.sourceTitle ?? ""
  if (!base && n.sourceUrl) {
    try {
      base = new URL(n.sourceUrl).hostname.replace(/^www\./, "")
    } catch {
      base = n.sourceUrl
    }
  }
  return n.sourcePage ? `${base}, p. ${n.sourcePage}` : base
}

export function NoteItem({ note }: { note: NoteDTO }) {
  const { update, remove } = useNoteActions()
  const convTitle = useConversationTitle(note.conversationId ?? "", "")
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title ?? "")
  const [content, setContent] = useState(note.content)

  const heading = note.title?.trim() || null
  // Quando a nota é só um trecho guardado, o conteúdo repete o trecho.
  const showContent = note.content.trim() && note.content.trim() !== note.quote?.trim()
  const source = sourceText(note)

  async function save() {
    const next = { title: title.trim() || null, content: content.trim() }
    if (!next.content) return
    const ok = await update(note.id, next)
    if (ok) setEditing(false)
  }

  if (editing) {
    return (
      <li className="space-y-2 rounded-lg border bg-card p-4">
        <label className="sr-only" htmlFor={`title-${note.id}`}>
          Título
        </label>
        <input
          id={`title-${note.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título (opcional)"
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm font-medium"
        />
        <label className="sr-only" htmlFor={`content-${note.id}`}>
          Conteúdo
        </label>
        <textarea
          id={`content-${note.id}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="block w-full resize-y rounded-md border border-input bg-background px-2.5 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={!content.trim()}>
            Salvar nota
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="group space-y-2.5 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          {heading && <h2 className="font-medium leading-snug">{heading}</h2>}
          <p className="text-xs text-muted-foreground">{dateFmt.format(new Date(note.createdAt))}</p>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          <Button variant="ghost" size="icon" className="size-8 pointer-coarse:size-11" aria-label="Editar nota" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 pointer-coarse:size-11" aria-label="Apagar nota" onClick={() => void remove(note)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {note.quote && (
        <blockquote className="border-l-2 border-tool pl-3 font-serif text-[15px] leading-relaxed">
          {note.quote}
        </blockquote>
      )}
      {/* Conteúdo pode vir de "Guardar resposta" (Markdown da resposta). */}
      {showContent && (
        <div className="text-sm">
          <Markdown text={note.content} />
        </div>
      )}

      {(note.conversationId || source) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {note.conversationId && (
            <Link
              href={`/c/${note.conversationId}${note.messageId ? `#msg-${note.messageId}` : ""}`}
              className="inline-flex min-w-0 items-center gap-1 hover:text-foreground hover:underline"
            >
              <MessageSquare className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{convTitle || "Abrir conversa"}</span>
            </Link>
          )}
          {source &&
            (note.sourceUrl ? (
              <a
                href={note.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 items-center gap-1 hover:text-foreground hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{source}</span>
              </a>
            ) : (
              <span className="truncate">{source}</span>
            ))}
        </div>
      )}
    </li>
  )
}
