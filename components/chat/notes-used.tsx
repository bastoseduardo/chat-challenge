"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronRight, NotebookPen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NotesUsedData } from "@/lib/notes/context"

/**
 * Passo "Consultou N notas do caderno" (SPEC-R4-006), vindo da parte
 * `data-notes-used` da resposta. Fica no mesmo estilo da trilha de pesquisa.
 */
export function NotesUsed({ data }: { data: NotesUsedData }) {
  const [open, setOpen] = useState(false)
  const n = data.notes.length
  if (n === 0) return null

  return (
    <div className="my-3 font-sans">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground transition-colors pointer-coarse:py-2"
      >
        <NotebookPen className="size-3.5 text-tool" aria-hidden />
        Consultou {n} {n === 1 ? "nota" : "notas"} do caderno
        <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} aria-hidden />
      </button>
      {open && (
        <ul className="mt-2 ml-[7px] space-y-2 border-l-2 border-tool/50 pl-4">
          {data.notes.map((note) => (
            <li key={note.id} className="text-sm">
              <Link href="/caderno" className="font-medium hover:underline">
                {note.title}
              </Link>
              {note.quote && note.quote !== note.title && (
                <p className="mt-0.5 line-clamp-2 font-serif text-[13px] text-muted-foreground">
                  “{note.quote}”
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
