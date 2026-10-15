import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { searchNotes } from "@/lib/db/queries/notes"
import { searchNotesQuerySchema } from "@/lib/notes/schema"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const parsed = searchNotesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })

  const notes = await searchNotes(user.id, parsed.data.q)
  return NextResponse.json({ notes })
}
