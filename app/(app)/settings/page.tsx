export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { userSettings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { SettingsForm } from "@/components/settings/settings-form"

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
    <>
      <AppHeader title={<h1 className="truncate px-1 font-semibold">Configurações</h1>} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
          <SettingsForm
            initial={{
              enabledTools: settings?.enabledTools ?? ["web_search", "web_scrape", "get_current_time"],
              mcpConfig: JSON.stringify(settings?.mcpConfig ?? {}, null, 2),
            }}
          />
        </div>
      </div>
    </>
  )
}
