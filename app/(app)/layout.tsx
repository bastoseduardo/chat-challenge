import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listConversations } from "@/lib/db/queries/conversations"
import { Sidebar } from "@/components/chat/sidebar"
import { QueryProvider } from "@/components/providers/query-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// Shell único do app (chat, configurações, uso, audit): a sidebar persiste
// entre rotas. A lista de conversas vem do servidor só na primeira carga;
// depois disso o cache do cliente é a fonte da verdade.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [conversations, cookieStore] = await Promise.all([listConversations(user.id), cookies()])
  // Estado recolhido/expandido da sidebar no desktop, gravado pelo componente
  // em cookie pra não piscar no SSR.
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <QueryProvider
      initialConversations={conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
      }))}
    >
      <SidebarProvider
        defaultOpen={sidebarOpen}
        className="h-dvh min-h-0 overflow-hidden"
        style={{ "--sidebar-width": "16.5rem" } as React.CSSProperties}
      >
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-md"
        >
          Ir para o conteúdo
        </a>
        <Sidebar
          user={{
            id: user.id,
            email: user.email ?? "",
            name: user.user_metadata?.full_name ?? user.email ?? "",
            avatar: user.user_metadata?.avatar_url ?? null,
          }}
        />
        <SidebarInset id="main" className="min-h-0 min-w-0 overflow-hidden">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  )
}
