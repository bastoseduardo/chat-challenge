import { db } from "@/lib/db/client"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

function adminEmailsFromEnv(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export async function isAdmin(user: { id: string; email?: string | null }): Promise<boolean> {
  const envEmails = adminEmailsFromEnv()
  if (user.email && envEmails.includes(user.email.toLowerCase())) return true
  const [row] = await db
    .select({ isAdmin: profiles.isAdmin })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1)
  return !!row?.isAdmin
}
