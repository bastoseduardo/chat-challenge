export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { userSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { SettingsForm } from "@/components/settings/settings-form"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1)

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold">Configurações</h1>
      </div>

      <SettingsForm
        initial={{
          enabledTools: settings?.enabledTools ?? ["web_search", "web_scrape", "get_current_time"],
          mcpConfig: JSON.stringify(settings?.mcpConfig ?? {}, null, 2),
        }}
      />
    </div>
  )
}
