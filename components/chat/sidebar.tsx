"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import {
  BarChart3,
  LogOut,
  MessageSquarePlus,
  Moon,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Settings,
  Sun,
  Trash2,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { CommandPalette } from "@/components/search/command-palette"
import {
  useConversationActions,
  useConversations,
  type ConversationSummary,
} from "@/lib/conversations/store"

interface SidebarProps {
  user: { id: string; email: string; name: string; avatar: string | null }
}

const GROUPS = ["Hoje", "Ontem", "Últimos 7 dias", "Mais antigas"] as const

function groupOf(iso: string, now: Date): (typeof GROUPS)[number] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = new Date(iso).getTime()
  const day = 86_400_000
  if (t >= startOfToday) return "Hoje"
  if (t >= startOfToday - day) return "Ontem"
  if (t >= startOfToday - 6 * day) return "Últimos 7 dias"
  return "Mais antigas"
}

// Classe do item ativo: barra de tinta à esquerda, além do fundo.
const activeBar = "data-[active=true]:shadow-[inset_2px_0_0_var(--primary)]"

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const { resolvedTheme, setTheme } = useTheme()
  const { data: conversations = [] } = useConversations()
  const actions = useConversationActions()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [paletteOpen, setPaletteOpen] = useState(false)
  const signOutRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const grouped = useMemo(() => {
    const now = new Date()
    const map = new Map<string, ConversationSummary[]>()
    for (const c of conversations) {
      const g = groupOf(c.updatedAt, now)
      map.set(g, [...(map.get(g) ?? []), c])
    }
    return GROUPS.filter((g) => map.has(g)).map((g) => ({ label: g, items: map.get(g)! }))
  }, [conversations])

  // No mobile a sidebar é uma gaveta: fecha ao navegar.
  function closeOnMobile() {
    if (isMobile) setOpenMobile(false)
  }

  function newChat() {
    closeOnMobile()
    router.push("/c/new")
  }

  // Sem confirm(): a conversa some na hora e o toast oferece "Desfazer"
  // (o delete é soft no banco).
  function deleteConv(id: string) {
    if (pathname === `/c/${id}`) router.push("/c/new")
    void actions.remove(id)
  }

  function submitRename(id: string, currentTitle: string) {
    const title = renameValue.trim()
    setRenamingId(null)
    if (!title || title === currentTitle) return
    void actions.rename(id, title)
  }

  const isDark = resolvedTheme === "dark"

  return (
    <SidebarRoot collapsible="icon">
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={newChat}
              tooltip="Nova conversa"
              className="bg-primary font-medium text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground pointer-coarse:h-11"
            >
              <Plus />
              <span>Nova conversa</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setPaletteOpen(true)}
              tooltip="Buscar (Ctrl+K)"
              className="border bg-background text-muted-foreground pointer-coarse:h-11"
            >
              <Search />
              <span className="flex-1">Buscar</span>
              <kbd className="rounded-sm border px-1 text-[11px] group-data-[collapsible=icon]:hidden pointer-coarse:hidden">
                Ctrl K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="group-data-[collapsible=icon]:hidden">
        {conversations.length === 0 && (
          <div className="space-y-3 px-4 py-8 text-center">
            <MessageSquarePlus className="mx-auto size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Suas conversas aparecem aqui.
            </p>
          </div>
        )}
        {grouped.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((c) => {
                const active = pathname === `/c/${c.id}`
                if (renamingId === c.id) {
                  return (
                    <SidebarMenuItem key={c.id}>
                      <input
                        autoFocus
                        value={renameValue}
                        aria-label="Novo título da conversa"
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => submitRename(c.id, c.title)}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitRename(c.id, c.title)
                          if (e.key === "Escape") setRenamingId(null)
                        }}
                        className="h-8 w-full rounded-md border border-ring bg-background px-2 text-sm outline-none"
                      />
                    </SidebarMenuItem>
                  )
                }
                return (
                  <SidebarMenuItem key={c.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className={`${activeBar} pointer-coarse:h-11`}
                    >
                      <Link href={`/c/${c.id}`} title={c.title} onClick={closeOnMobile}>
                        <span>{c.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          showOnHover
                          aria-label={`Opções de ${c.title}`}
                          className="pointer-coarse:size-9"
                        >
                          <MoreHorizontal />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onSelect={() => {
                            setRenameValue(c.title)
                            setRenamingId(c.id)
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => deleteConv(c.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-4" />
                          Apagar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/caderno"}
              tooltip="Caderno"
              className={`${activeBar} pointer-coarse:h-11`}
            >
              <Link href="/caderno" onClick={closeOnMobile}>
                <NotebookPen />
                <span>Caderno</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/usage"}
              tooltip="Uso"
              className={`${activeBar} pointer-coarse:h-11`}
            >
              <Link href="/usage" onClick={closeOnMobile}>
                <BarChart3 />
                <span>Uso</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/settings"}
              tooltip="Configurações"
              className={`${activeBar} pointer-coarse:h-11`}
            >
              <Link href="/settings" onClick={closeOnMobile}>
                <Settings />
                <span>Configurações</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip={user.name} aria-label="Conta e preferências">
                  <Avatar className="size-8 rounded-md">
                    {user.avatar && <AvatarImage src={user.avatar} alt="" />}
                    <AvatarFallback className="rounded-md">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                  <MoreHorizontal className="ml-auto size-4 text-muted-foreground" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" className="min-w-52">
                <DropdownMenuItem onSelect={() => setTheme(isDark ? "light" : "dark")}>
                  {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                  {isDark ? "Usar tema claro" : "Usar tema escuro"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => signOutRef.current?.requestSubmit()}>
                  <LogOut className="mr-2 size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <form ref={signOutRef} action="/auth/signout" method="post" className="hidden" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </SidebarRoot>
  )
}
