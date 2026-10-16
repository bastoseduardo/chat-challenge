import { SidebarTrigger } from "@/components/ui/sidebar"

/**
 * Barra superior de todas as telas do shell. O SidebarTrigger abre a sidebar
 * como gaveta no mobile e recolhe/expande no desktop (atalho Ctrl/⌘+B).
 */
export function AppHeader({
  title,
  children,
}: {
  title: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
      <SidebarTrigger
        className="size-9 shrink-0 text-muted-foreground pointer-coarse:size-11"
        aria-label="Abrir ou fechar a barra lateral"
      />
      <div className="min-w-0 flex-1">{title}</div>
      {children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
    </header>
  )
}
