import { db } from "@/lib/db/client"
import { toolInvocations } from "@/lib/db/schema"
import { logAudit } from "@/lib/audit/log"

interface Args {
  userId: string
  messageId: string
  mcpToolNames?: Set<string>
  toolCalls: Array<{
    toolCallId?: string
    toolName?: string
    input?: unknown
    args?: unknown
  }>
  toolResults: Array<{
    toolCallId?: string
    toolName?: string
    output?: unknown
    result?: unknown
  }>
}

export async function persistToolInvocations({
  userId,
  messageId,
  mcpToolNames,
  toolCalls,
  toolResults,
}: Args): Promise<void> {
  if (toolCalls.length === 0) return
  const resultByCallId = new Map<string, unknown>()
  for (const r of toolResults) {
    if (r.toolCallId) resultByCallId.set(r.toolCallId, r.output ?? r.result)
  }
  for (const call of toolCalls) {
    const toolName = call.toolName ?? "unknown"
    const toolSource = mcpToolNames?.has(toolName) ? "mcp" : "builtin"
    const args = (call.input ?? call.args ?? {}) as unknown
    const result = call.toolCallId ? resultByCallId.get(call.toolCallId) : undefined
    try {
      await db.insert(toolInvocations).values({
        messageId,
        toolName,
        toolSource,
        args: args as object,
        result: (result ?? null) as object | null,
      })
    } catch (err) {
      console.error("[tool-persist]", err)
    }
    await logAudit({
      userId,
      eventType: "tool.invoked",
      resourceType: "message",
      resourceId: messageId,
      metadata: {
        tool_name: toolName,
        tool_source: toolSource,
        has_result: result !== undefined,
      },
    })
  }
}
