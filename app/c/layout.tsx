export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { listConversations } from "@/lib/db/queries/conversations"
import { Sidebar } from "@/components/chat/sidebar"

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const conversations = await listConversations(user.id)

  return (
    <div className="h-dvh flex overflow-hidden">
      <Sidebar
        conversations={conversations.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
        }))}
        user={{
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name ?? user.email ?? "",
          avatar: user.user_metadata?.avatar_url ?? null,
        }}
      />
      <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">{children}</main>
    </div>
  )
}
