export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { conversations } from "@/lib/db/schema"
import { and, eq, isNull, desc } from "drizzle-orm"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [latest] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.userId, user.id), isNull(conversations.deletedAt)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1)

  if (latest) redirect(`/c/${latest.id}`)

  redirect("/c/new")
}
