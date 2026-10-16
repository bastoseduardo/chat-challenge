"use client"

import { useState } from "react"
import { useConversationActions } from "@/lib/conversations/store"

/** Título da conversa no cabeçalho; clicar permite renomear no lugar. */
export function EditableTitle({
  conversationId,
  title,
  editable,
}: {
  conversationId: string
  title: string
  editable: boolean
}) {
  const actions = useConversationActions()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(title)

  function save() {
    setEditing(false)
    const next = value.trim()
    if (next && next !== title) void actions.rename(conversationId, next)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        aria-label="Título da conversa"
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") setEditing(false)
        }}
        className="h-9 w-full max-w-md rounded-md border border-ring bg-background px-2 font-semibold outline-none"
      />
    )
  }

  if (!editable) {
    return <h1 className="truncate px-1 font-semibold">{title}</h1>
  }

  return (
    <h1 className="min-w-0">
      <button
        type="button"
        title="Renomear conversa"
        onClick={() => {
          setValue(title)
          setEditing(true)
        }}
        className="block max-w-full truncate rounded-md px-1 py-1 text-left font-semibold hover:bg-accent transition-colors"
      >
        {title}
      </button>
    </h1>
  )
}
