import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { AuditLog } from "@/components/admin/audit-log"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/auth/admin"

export const metadata = { title: "Audit log" }

export default async function AuditPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isAdmin({ id: user.id, email: user.email }))) redirect("/")

  return (
    <>
      <AppHeader title={<h1 className="truncate px-1 font-semibold">Audit log</h1>} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          {/* useSearchParams exige Suspense no App Router */}
          <Suspense>
            <AuditLog />
          </Suspense>
        </div>
      </div>
    </>
  )
}
