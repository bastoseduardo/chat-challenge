"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, MoreHorizontal, Trash2, Pencil, LogOut, Settings, BarChart3, MessageSquarePlus, Search } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme/toggle"
import { SearchDialog } from "@/components/search/search-dialog"

interface Conversation {
  id: string
  title: string
  updatedAt: string
}

interface SidebarProps {
  conversations: Conversation[]
  user: { id: string; email: string; name: string; avatar: string | null }
}

export function Sidebar({ conversations, user }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  async function newChat() {
    const res = await fetch("/api/conversations", { method: "POST" })
    const data = await res.json()
    if (data.conversation?.id) {
      router.push(`/c/${data.conversation.id}`)
      router.refresh()
    }
  }

  async function deleteConv(id: string) {
    if (!confirm("Deletar esta conversa?")) return
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Conversa deletada")
      startTransition(() => {
        if (pathname === `/c/${id}`) router.push("/")
        router.refresh()
      })
    }
  }

  async function submitRename(id: string) {
    const title = renameValue.trim()
    setRenamingId(null)
    if (!title) return
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <aside className="w-64 border-r flex flex-col shrink-0 bg-card min-h-0 overflow-hidden">
      <div className="p-3 border-b space-y-2">
        <Button onClick={newChat} className="w-full justify-start gap-2" size="sm">
          <Plus className="w-4 h-4" />
          Nova conversa
        </Button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-background text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="hidden sm:inline-flex items-center text-[10px] border px-1 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-0.5">
          {conversations.length === 0 && (
            <div className="px-3 py-6 text-center space-y-3">
              <MessageSquarePlus className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
              <p className="text-xs text-muted-foreground">
                Nenhuma conversa ainda. Clique em &quot;Nova conversa&quot; pra começar.
              </p>
            </div>
          )}
          {conversations.map((c) => {
            const active = pathname === `/c/${c.id}`
            if (renamingId === c.id) {
              return (
                <input
                  key={c.id}
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename(c.id)
                    if (e.key === "Escape") setRenamingId(null)
                  }}
                  className="w-full px-2 py-1.5 rounded text-sm bg-background border"
                />
              )
            }
            return (
              <div
                key={c.id}
                className={cn(
                  "group flex items-center rounded hover:bg-accent",
                  active && "bg-accent"
                )}
              >
                <Link
                  href={`/c/${c.id}`}
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm truncate"
                >
                  {c.title}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="p-1 mr-1 opacity-40 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 rounded hover:bg-background text-muted-foreground transition-opacity"
                      aria-label="Menu da conversa"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameValue(c.title)
                        setRenamingId(c.id)
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteConv(c.id)}
                      disabled={isPending}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deletar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-3 space-y-1">
        <Link
          href="/usage"
          className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent"
        >
          <BarChart3 className="w-4 h-4" />
          Uso
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-accent"
        >
          <Settings className="w-4 h-4" />
          Configurações
        </Link>
        <div className="flex items-center gap-2 pt-2">
          <Avatar className="w-7 h-7">
            {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
            <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-xs">
            <div className="truncate font-medium">{user.name}</div>
            <div className="truncate text-muted-foreground">{user.email}</div>
          </div>
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="p-1.5 rounded hover:bg-accent"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </aside>
  )
}
