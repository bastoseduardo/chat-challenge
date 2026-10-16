import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { and, eq, isNull, or, sql } from "drizzle-orm"
import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"
import { getConversation } from "@/lib/db/queries/conversations"
import { logAudit } from "@/lib/audit/log"
import { TRUNCATE_BLOCKED_MESSAGE, truncateBlocked } from "@/lib/conversations/truncate-rule"
import { invalidateShareSummary } from "@/lib/share/invalidate"
import { alias } from "drizzle-orm/pg-core"

// O cliente conhece a mensagem pelo id do banco (depois de recarregar) ou pelo
// id que ele mesmo gerou (gravado em client_message_id) antes de recarregar.
const bodySchema = z.object({ fromMessageId: z.string().min(1).max(100) })

/** Editar e reenviar (SPEC-R4-008): soft delete da mensagem e das seguintes. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const conv = await getConversation(id, user.id)
  if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 })
  const { fromMessageId } = parsed.data

  const [from] = await db
    .select({ id: messages.id, role: messages.role, createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, id),
        isNull(messages.deletedAt),
        or(sql`${messages.id}::text = ${fromMessageId}`, eq(messages.clientMessageId, fromMessageId))
      )
    )
    .limit(1)
  if (!from || from.role !== "user") {
    return NextResponse.json({ error: "message_not_found" }, { status: 404 })
  }

  // Data da última mensagem resumida por cada resumo (ou a do resumo, se antigo).
  const cutoffMsg = alias(messages, "cutoff")
  const summaries = await db
    .select({ createdAt: messages.createdAt, cutoffCreatedAt: cutoffMsg.createdAt })
    .from(messages)
    .leftJoin(cutoffMsg, eq(cutoffMsg.id, messages.summarizesUntilMessageId))
    .where(and(eq(messages.conversationId, id), eq(messages.isSummary, true), isNull(messages.deletedAt)))
  if (truncateBlocked(from.createdAt, summaries.map((s) => s.cutoffCreatedAt ?? s.createdAt))) {
    return NextResponse.json({ error: "summarized", message: TRUNCATE_BLOCKED_MESSAGE }, { status: 409 })
  }

  const removed = await db
    .update(messages)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(messages.conversationId, id),
        isNull(messages.deletedAt),
        // O resumo (criado depois das mensagens recentes que ele não cobre) fica.
        eq(messages.isSummary, false),
        // No SQL, com microssegundos (o Date do JS trunca em ms).
        sql`${messages.createdAt} >= (select m.created_at from messages m where m.id = ${from.id}::uuid)`
      )
    )
    .returning({ id: messages.id })
  if (removed.length > 0) await invalidateShareSummary(id)

  await logAudit({
    userId: user.id,
    eventType: "message.edited",
    resourceType: "conversation",
    resourceId: id,
    metadata: { from_message_id: from.id, removed: removed.length },
  })

  return NextResponse.json({ ok: true, removed: removed.length })
}
