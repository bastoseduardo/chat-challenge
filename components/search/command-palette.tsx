"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, Loader2, MessageSquare, Moon, Plus, Settings, Sparkles, Sun } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { succeeded, useConversations } from "@/lib/conversations/store"

interface SearchResult {
  messageId: string
  conversationId: string
  conversationTitle: string
  role: string
  preview: string
  similarity: number
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

async function semanticSearch(q: string, signal: AbortSignal): Promise<SearchResult[]> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal })
  if (res.status === 429) throw new Error("Muitas buscas seguidas. Espere alguns segundos.")
  if (!succeeded(res)) throw new Error("A busca por significado não está disponível agora.")
  const data = (await res.json()) as { results?: SearchResult[] }
  return data.results ?? []
}

/**
 * Ctrl/⌘+K: ações do app, conversas por título e busca por significado
 * (embeddings) no conteúdo das mensagens. O filtro é manual porque os
 * resultados semânticos nem sempre contêm o texto digitado.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { data: conversations = [] } = useConversations()
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const debounced = useDebounced(q, 250)

  const search = useQuery({
    queryKey: ["semantic-search", debounced],
    queryFn: ({ signal }) => semanticSearch(debounced, signal),
    enabled: open && debounced.length >= 3,
    staleTime: 60_000,
    retry: false,
  })

  function setOpen(next: boolean) {
    if (!next) setQuery("")
    onOpenChange(next)
  }

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  const isDark = resolvedTheme === "dark"
  const actions = [
    { id: "new", label: "Nova conversa", icon: Plus, run: () => go("/c/new") },
    { id: "settings", label: "Abrir configurações", icon: Settings, run: () => go("/settings") },
    { id: "usage", label: "Ver uso de hoje", icon: BarChart3, run: () => go("/usage") },
    {
      id: "theme",
      label: isDark ? "Usar tema claro" : "Usar tema escuro",
      icon: isDark ? Sun : Moon,
      run: () => {
        setTheme(isDark ? "light" : "dark")
        setOpen(false)
      },
    },
  ].filter((a) => !q || a.label.toLowerCase().includes(q))

  const titles = (q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations).slice(
    0,
    q ? 8 : 5
  )
  const semantic = debounced === q && q.length >= 3 ? (search.data ?? []) : []
  const searching = q.length >= 3 && (debounced !== q || search.isFetching)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Buscar e executar ações</DialogTitle>
        <DialogDescription className="sr-only">
          Digite para filtrar ações e conversas. Com 3 letras ou mais, a busca também procura
          pelo significado no conteúdo das mensagens.
        </DialogDescription>
        <Command shouldFilter={false} loop>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar conversas ou digitar um comando"
          />
          <CommandList className="max-h-[min(60vh,420px)]">
            {!searching && actions.length + titles.length + semantic.length === 0 && (
              <CommandEmpty>
                {search.isError ? (search.error as Error).message : "Nada encontrado."}
              </CommandEmpty>
            )}
            {actions.length > 0 && (
              <CommandGroup heading="Ações">
                {actions.map((a) => (
                  <CommandItem key={a.id} value={`action-${a.id}`} onSelect={a.run}>
                    <a.icon className="mr-2 size-4" />
                    {a.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {titles.length > 0 && (
              <CommandGroup heading={q ? "Conversas com esse título" : "Conversas recentes"}>
                {titles.map((c) => (
                  <CommandItem key={c.id} value={`conv-${c.id}`} onSelect={() => go(`/c/${c.id}`)}>
                    <MessageSquare className="mr-2 size-4" />
                    <span className="truncate">{c.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {(semantic.length > 0 || searching) && (
              <CommandGroup heading="No conteúdo das mensagens">
                {searching && semantic.length === 0 && (
                  <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Procurando pelo significado…
                  </div>
                )}
                {semantic.map((r) => (
                  <CommandItem
                    key={r.messageId}
                    value={`msg-${r.messageId}`}
                    onSelect={() => go(`/c/${r.conversationId}#msg-${r.messageId}`)}
                    className="items-start"
                  >
                    <Sparkles className="mr-2 mt-0.5 size-4 shrink-0 text-tool" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.conversationTitle}
                      </span>
                      <span className="line-clamp-2 text-sm">{r.preview}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="hidden items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground sm:flex">
            <span>↑↓ para navegar</span>
            <span>Enter para abrir</span>
            <span className="ml-auto">Esc para fechar</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
