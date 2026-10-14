"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Search, Loader2, MessageSquare, Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchResult {
  messageId: string
  conversationId: string
  conversationTitle: string
  role: string
  preview: string
  createdAt: string
  similarity: number
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setError(null)
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    } else {
      abortRef.current?.abort()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        })
        if (!res.ok) {
          if (res.status === 500) setError("Embeddings indisponíveis")
          else if (res.status === 429) setError("Muitas buscas, aguarde um pouco")
          else setError("Erro na busca")
          setResults([])
        } else {
          const data = await res.json()
          setResults(data.results ?? [])
          setCursor(0)
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError("Erro na busca")
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, open])

  function openResult(r: SearchResult) {
    onOpenChange(false)
    router.push(`/c/${r.conversationId}#msg-${r.messageId}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      openResult(results[cursor])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Buscar nas conversas</DialogTitle>
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          {loading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar semanticamente nas suas conversas..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground border px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {query.trim().length < 2 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Digite ao menos 2 caracteres pra buscar.
              <br />
              <span className="text-xs">
                A busca entende significado, não só palavras exatas.
              </span>
            </div>
          )}
          {error && (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          )}
          {!error && !loading && query.trim().length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum resultado.
            </div>
          )}
          {results.map((r, i) => {
            const Icon = r.role === "assistant" ? Bot : User
            return (
              <button
                key={r.messageId}
                onClick={() => openResult(r)}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b last:border-0 flex gap-3 items-start",
                  cursor === i ? "bg-accent" : "hover:bg-accent/50"
                )}
              >
                <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {r.conversationTitle}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {r.similarity}% match
                    </span>
                  </div>
                  <p className="text-sm line-clamp-2 text-foreground">{r.preview}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t text-[10px] text-muted-foreground">
          <span>
            <kbd className="border px-1 rounded">↑</kbd>{" "}
            <kbd className="border px-1 rounded">↓</kbd> navegar
          </span>
          <span>
            <kbd className="border px-1 rounded">Enter</kbd> abrir
          </span>
          <span className="ml-auto">Busca semântica via Voyage AI + pgvector</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
