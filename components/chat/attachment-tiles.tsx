"use client"

import { X, FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PendingAttachment } from "./use-attachments"

interface Props {
  items: PendingAttachment[]
  onRemove: (id: string) => void
}

export function AttachmentTiles({ items, onRemove }: Props) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label="Anexos">
      {items.map((a) => (
        <li
          key={a.id}
          className={cn(
            "relative flex min-w-0 items-center gap-2 rounded-md border bg-background py-1.5 pl-1.5 pr-1 text-xs",
            a.status === "error" && "border-destructive/60"
          )}
        >
          {a.kind === "image" && a.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.previewUrl} alt="" className="size-8 rounded-sm object-cover" />
          ) : (
            <div className="grid size-8 shrink-0 place-items-center rounded-sm bg-muted">
              <FileText className="size-4" />
            </div>
          )}
          <span className="max-w-[160px] truncate">{a.originalName}</span>
          {a.status === "uploading" && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Enviando" />
          )}
          {a.status === "error" && <span className="text-destructive">Falhou</span>}
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            className="grid size-6 place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground pointer-coarse:size-9"
            aria-label={`Remover ${a.originalName}`}
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}
