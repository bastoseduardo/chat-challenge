"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { NotebookPen } from "lucide-react"
import { useNoteActions } from "@/lib/notes/store"
import { useCitationSources } from "./citations"

interface Selected {
  text: string
  sourceIndex?: number
  /** posição do botão (viewport) no modo flutuante */
  top: number
  left: number
}

const MAX_QUOTE = 5000

/**
 * Selecionar texto dentro de uma resposta mostra "Guardar no caderno"
 * (SPEC-R4-005). Leva o trecho (sem os números das marcações) e a fonte da
 * marcação dentro da seleção ou logo depois dela. Atalho: Ctrl/⌘+Shift+S.
 * No toque, o botão fica fixo acima do composer pra não disputar com o menu
 * nativo de seleção.
 */
export function SelectionToSave({
  conversationId,
  messageId,
  children,
}: {
  conversationId: string
  messageId: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [saving, setSaving] = useState(false)
  const [coarse] = useState(() => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches)
  const sources = useCitationSources()
  const { create } = useNoteActions()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    function read() {
      const s = window.getSelection()
      const root = ref.current
      if (!s || s.isCollapsed || s.rangeCount === 0 || !root) return setSelected(null)
      const range = s.getRangeAt(0)
      if (!root.contains(range.commonAncestorContainer)) return setSelected(null)

      const frag = range.cloneContents()
      const inside = Array.from(frag.querySelectorAll(".citation-mark")).map((el) => Number(el.textContent))
      frag.querySelectorAll(".citation-marks").forEach((el) => el.remove())
      const text = (frag.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUOTE)
      if (text.length < 3) return setSelected(null)

      // Sem marcação dentro da seleção: a primeira marcação depois dela.
      let sourceIndex = inside.find(Boolean)
      if (!sourceIndex) {
        const after = Array.from(root.querySelectorAll<HTMLElement>(".citation-mark")).find((el) =>
          range.comparePoint(el, 0) > 0
        )
        sourceIndex = after ? Number(after.textContent) : undefined
      }

      const rect = range.getBoundingClientRect()
      setSelected({ text, sourceIndex, top: Math.max(8, rect.top - 44), left: rect.left + rect.width / 2 })
    }
    function onChange() {
      clearTimeout(timer)
      timer = setTimeout(read, 120)
    }
    document.addEventListener("selectionchange", onChange)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("selectionchange", onChange)
    }
  }, [])

  async function save() {
    if (!selected || saving) return
    const source = sources.find((s) => s.index === selected.sourceIndex)
    setSaving(true)
    const note = await create({
      quote: selected.text,
      conversationId,
      messageId,
      ...(source && {
        source: {
          ...(source.url && { url: source.url }),
          title: source.title.slice(0, 300),
          ...(source.pages && { page: source.pages.start }),
        },
      }),
    })
    setSaving(false)
    if (note) {
      window.getSelection()?.removeAllRanges()
      setSelected(null)
    }
  }

  useEffect(() => {
    if (!selected) return
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const button = selected && (
    <button
      type="button"
      // Mantém a seleção ao clicar.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void save()}
      disabled={saving}
      className={
        coarse
          ? "fixed bottom-28 left-1/2 z-50 inline-flex h-11 -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium shadow-lg"
          : "fixed z-50 inline-flex h-9 -translate-x-1/2 items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium shadow-lg hover:bg-accent"
      }
      style={coarse ? undefined : { top: selected.top, left: selected.left }}
      title="Guardar no caderno (Ctrl+Shift+S)"
    >
      <NotebookPen className="size-4 text-tool" aria-hidden />
      {saving ? "Guardando…" : "Guardar no caderno"}
    </button>
  )

  return (
    <div ref={ref}>
      {children}
      {button && createPortal(button, document.body)}
    </div>
  )
}
