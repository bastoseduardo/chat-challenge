import { createServiceClient } from "@/lib/supabase/service"

export type AuditEventType =
  | "user.login"
  | "user.logout"
  | "conversation.created"
  | "conversation.deleted"
  | "conversation.restored"
  | "conversation.shared"
  | "conversation.unshared"
  | "message.sent"
  | "message.received"
  | "message.edited"
  | "tool.invoked"
  | "attachment.uploaded"
  | "compaction.executed"
  | "quota.exceeded"
  | "mcp.server.connected"
  | "note.created"
  | "note.deleted"

export interface AuditPayload {
  userId: string | null
  eventType: AuditEventType
  resourceType?: string
  resourceId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from("audit_events").insert({
      user_id: payload.userId,
      event_type: payload.eventType,
      resource_type: payload.resourceType ?? null,
      resource_id: payload.resourceId ?? null,
      metadata: payload.metadata ?? {},
      ip_address: payload.ipAddress ?? null,
      user_agent: payload.userAgent ?? null,
    })
    if (error) {
      console.error("[audit] insert failed:", error.message)
    }
  } catch (err) {
    console.error("[audit] unexpected error:", err)
  }
}
