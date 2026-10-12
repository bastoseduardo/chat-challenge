"use client"

import { X, FileText, Loader2 } from "lucide-react"
import type { PendingAttachment } from "./use-attachments"

interface Props {
  items: PendingAttachment[]
  onRemove: (id: string) => void
}

export function AttachmentTiles({ items, onRemove }: Props) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {items.map((a) => (
        <div
          key={a.id}
          className="relative flex items-center gap-2 px-2 py-1.5 rounded border bg-background text-xs min-w-0"
        >
          {a.kind === "image" && a.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.previewUrl} alt="" className="w-8 h-8 object-cover rounded" />
          ) : (
            <div className="w-8 h-8 rounded bg-muted grid place-items-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
          )}
          <span className="truncate max-w-[160px]">{a.originalName}</span>
          {a.status === "uploading" && <Loader2 className="w-3 h-3 animate-spin" />}
          {a.status === "error" && <span className="text-destructive">erro</span>}
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            className="ml-1 p-0.5 rounded hover:bg-accent"
            aria-label="Remover"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
