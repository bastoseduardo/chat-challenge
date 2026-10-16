import { NextResponse, type NextRequest } from "next/server"
import { nanoid } from "nanoid"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { shares, conversations } from "@/lib/db/schema"
import { and, eq, isNull } from "drizzle-orm"
import { logAudit } from "@/lib/audit/log"
import { generateShareSummary } from "@/lib/ai/share-summary"
import { assertWithinCaps, QuotaError } from "@/lib/usage/caps"
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit"

// O resumo chama o modelo com até ~10 mil tokens da conversa: respeita a cota
// diária e um limite por usuário. Sem resumo, o link sai do mesmo jeito.
const SUMMARY_ESTIMATED_TOKENS = 12_000

async function summaryBlocked(userId: string): Promise<"quota" | "rate_limited" | null> {
  try {
    await assertRateLimit({ key: `share-summary:${userId}`, limit: 5, windowMs: 60_000 })
    await assertWithinCaps(userId, SUMMARY_ESTIMATED_TOKENS)
    return null
  } catch (err) {
    if (err instanceof RateLimitError) return "rate_limited"
    if (err instanceof QuotaError) return "quota"
    throw err
  }
}

async function assertOwnsConversation(convId: string, userId: string) {
  const [c] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, convId), eq(conversations.userId, userId)))
    .limit(1)
  return !!c
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  if (!(await assertOwnsConversation(id, user.id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const [existing] = await db
    .select({ token: shares.token, summary: shares.summary })
    .from(shares)
    .where(and(eq(shares.conversationId, id), isNull(shares.revokedAt)))
    .limit(1)

  return NextResponse.json({ token: existing?.token ?? null, summary: existing?.summary ?? null })
}

// POST cria o link (ou devolve o existente) e garante o resumo do relatório.
// ?regenerate=1 gera o resumo de novo. Falha no resumo não impede o link.
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  if (!(await assertOwnsConversation(id, user.id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const regenerate = req.nextUrl.searchParams.get("regenerate") === "1"
  const [existing] = await db
    .select({ id: shares.id, token: shares.token, summary: shares.summary })
    .from(shares)
    .where(and(eq(shares.conversationId, id), isNull(shares.revokedAt)))
    .limit(1)

  if (existing) {
    if (existing.summary && !regenerate) {
      return NextResponse.json({ token: existing.token, summary: existing.summary })
    }
    const blocked = await summaryBlocked(user.id)
    if (blocked) {
      return NextResponse.json({ token: existing.token, summary: existing.summary, summaryError: blocked })
    }
    const summary = await generateShareSummary({ conversationId: id, userId: user.id })
    if (summary) {
      await db
        .update(shares)
        .set({ summary, summaryGeneratedAt: new Date() })
        .where(eq(shares.id, existing.id))
    }
    return NextResponse.json({ token: existing.token, summary: summary ?? existing.summary })
  }

  const token = nanoid(24)
  const blocked = await summaryBlocked(user.id)
  const summary = blocked ? null : await generateShareSummary({ conversationId: id, userId: user.id })
  await db.insert(shares).values({
    conversationId: id,
    token,
    createdBy: user.id,
    summary,
    summaryGeneratedAt: summary ? new Date() : null,
  })

  await logAudit({
    userId: user.id,
    eventType: "conversation.shared",
    resourceType: "conversation",
    resourceId: id,
    metadata: { token },
  })

  return NextResponse.json({ token, summary, ...(blocked && { summaryError: blocked }) })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  if (!(await assertOwnsConversation(id, user.id))) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  await db
    .update(shares)
    .set({ revokedAt: new Date() })
    .where(and(eq(shares.conversationId, id), isNull(shares.revokedAt)))

  await logAudit({
    userId: user.id,
    eventType: "conversation.unshared",
    resourceType: "conversation",
    resourceId: id,
  })

  return NextResponse.json({ ok: true })
}
