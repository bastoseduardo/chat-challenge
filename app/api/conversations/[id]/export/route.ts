import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getConversation,
  listMessages,
} from "@/lib/db/queries/conversations"
import { db } from "@/lib/db/client"
import { attachments, toolInvocations } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import type { UIMessage } from "ai"
import { extractSources, footnotesMarkdown, textWithCitations } from "@/lib/sources/extract"

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const conv = await getConversation(id, user.id)
  if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 })

  const msgs = await listMessages(id)
  const format = req.nextUrl.searchParams.get("format") ?? "md"
  if (format !== "md" && format !== "json") {
    return NextResponse.json({ error: "invalid_format" }, { status: 400 })
  }

  if (format === "json") {
    return NextResponse.json({
      conversation: conv,
      messages: msgs,
    })
  }

  // Markdown
  const lines: string[] = []
  lines.push(`# ${conv.title}`)
  lines.push("")
  lines.push(`- **Model:** ${conv.model}`)
  lines.push(`- **Created:** ${conv.createdAt.toISOString()}`)
  lines.push(`- **Messages:** ${msgs.filter((m) => !m.isSummary).length}`)
  lines.push(`- **Compactions:** ${conv.compactionCount}`)
  if (conv.systemPrompt) {
    lines.push("")
    lines.push("## System Prompt")
    lines.push("")
    lines.push("```")
    lines.push(conv.systemPrompt)
    lines.push("```")
  }
  lines.push("")
  lines.push("---")
  lines.push("")

  // Notas de rodapé com prefixo único por resposta (r1-1, r2-1...): só a
  // numeração [n] se repete entre respostas.
  let cited = 0
  for (const m of msgs) {
    if (m.isSummary) {
      lines.push(`### 📜 Compaction summary`)
      lines.push(`*${m.createdAt.toISOString()}*`)
      lines.push("")
      lines.push(extractText(m.content))
      lines.push("")
      lines.push("---")
      lines.push("")
      continue
    }

    const roleLabel = m.role === "user" ? "🧑 **You**" : "🤖 **Assistant**"
    lines.push(`### ${roleLabel}`)
    lines.push(`*${m.createdAt.toISOString()}*`)

    if (m.role === "user") {
      const atts = await db
        .select()
        .from(attachments)
        .where(eq(attachments.messageId, m.id))
      if (atts.length) {
        lines.push("")
        lines.push("**Attachments:**")
        for (const a of atts) {
          lines.push(`- ${a.kind}: \`${a.originalName}\` (${Math.round(a.sizeBytes / 1024)}KB)`)
        }
      }
    }

    if (m.role === "assistant") {
      const invs = await db
        .select()
        .from(toolInvocations)
        .where(eq(toolInvocations.messageId, m.id))
        .orderBy(asc(toolInvocations.createdAt))
      for (const inv of invs) {
        lines.push("")
        lines.push(`**🔧 Tool:** \`${inv.toolName}\` (${inv.toolSource})`)
        lines.push("```json")
        lines.push(JSON.stringify(inv.args, null, 2))
        lines.push("```")
        if (inv.result) {
          lines.push("Result:")
          lines.push("```json")
          lines.push(JSON.stringify(inv.result, null, 2).slice(0, 2000))
          lines.push("```")
        }
      }
    }

    lines.push("")
    // Respostas com citações (SPEC-R4-003): marcas [^n] no texto e notas de
    // rodapé com as fontes. Mensagens antigas seguem só com o texto.
    const asMessage = { id: m.id, role: m.role, parts: Array.isArray(m.content) ? m.content : [] } as unknown as UIMessage
    const sources = m.role === "assistant" ? extractSources(asMessage) : []
    if (sources.length) {
      const tag = `r${++cited}`
      lines.push(textWithCitations(asMessage, (ix) => ix.map((n) => `[^${tag}-${n}]`).join("")))
      lines.push("")
      lines.push(footnotesMarkdown(sources).replace(/^\[\^(\d+)\]/gm, (_, n) => `[^${tag}-${n}]`))
    } else {
      lines.push(m.role === "assistant" ? textWithCitations(asMessage) || extractText(m.content) : extractText(m.content))
    }
    lines.push("")
    lines.push("---")
    lines.push("")
  }

  const body = lines.join("\n")
  const safeName = conv.title.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60) || "conversa"
  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${safeName}-${conv.id.slice(0, 8)}.md"`,
    },
  })
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter((p): p is { type: "text"; text: string } => {
      const o = p as { type?: string; text?: string }
      return o.type === "text" && typeof o.text === "string"
    })
    .map((p) => p.text)
    .join("\n")
}
