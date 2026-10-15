import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listConversations } from "@/lib/db/queries/conversations"
import { Sidebar } from "@/components/chat/sidebar"
import { QueryProvider } from "@/components/providers/query-provider"

// Shell único do app (chat, configurações, uso, audit): a sidebar persiste
// entre rotas. A lista de conversas vem do servidor só na primeira carga;
// depois disso o cache do cliente é a fonte da verdade.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const conversations = await listConversations(user.id)

  return (
    <QueryProvider
      initialConversations={conversations.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt.toISOString(),
      }))}
    >
      <div className="h-dvh flex overflow-hidden">
        <Sidebar
          user={{
            id: user.id,
            email: user.email ?? "",
            name: user.user_metadata?.full_name ?? user.email ?? "",
            avatar: user.user_metadata?.avatar_url ?? null,
          }}
        />
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">{children}</main>
      </div>
    </QueryProvider>
  )
}
