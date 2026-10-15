export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { isAdmin } from "@/lib/auth/admin"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

interface SearchParams {
  limit?: string
  offset?: string
  event_type?: string
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")
  if (!(await isAdmin({ id: user.id, email: user.email }))) redirect("/")

  const sp = await searchParams
  const limit = Math.min(100, Number(sp.limit ?? 50))
  const offset = Math.max(0, Number(sp.offset ?? 0))
  const eventType = sp.event_type ?? ""

  const service = createServiceClient()
  let q = service
    .from("audit_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
  if (eventType) q = q.eq("event_type", eventType)
  const { data, count } = await q

  const events = data ?? []
  const total = count ?? 0

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <Badge variant="outline">{total} eventos</Badge>
      </div>

      <form className="flex gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Event type</label>
          <select
            name="event_type"
            defaultValue={eventType}
            className="h-9 rounded border bg-background px-2 text-sm"
          >
            <option value="">Todos</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        {eventType && (
          <Link href="/admin/audit">
            <Button type="button" variant="ghost" size="sm">
              Limpar
            </Button>
          </Link>
        )}
      </form>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="border-b bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap w-44">Quando</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap w-48">Evento</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap w-28">User</th>
                  <th className="text-left px-3 py-2 font-medium whitespace-nowrap w-56">Resource</th>
                  <th className="text-left px-3 py-2 font-medium">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <code className="text-xs">{e.event_type}</code>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">
                      {e.user_id ? e.user_id.slice(0, 8) : "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">
                      {e.resource_type ?? "—"}
                      {e.resource_id && (
                        <span className="text-muted-foreground font-mono">
                          {" "}
                          · {e.resource_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <code className="block break-all text-muted-foreground">
                        {JSON.stringify(e.metadata)}
                      </code>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                      Nenhum evento
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-between">
        <Link
          href={buildHref(sp, Math.max(0, offset - limit))}
          className="pointer-events-auto"
        >
          <Button variant="outline" size="sm" disabled={offset === 0}>
            Anterior
          </Button>
        </Link>
        <span className="text-xs text-muted-foreground self-center">
          {offset + 1}–{Math.min(offset + limit, total)} de {total}
        </span>
        <Link href={buildHref(sp, offset + limit)}>
          <Button variant="outline" size="sm" disabled={offset + limit >= total}>
            Próxima
          </Button>
        </Link>
      </div>
    </div>
    </div>
  )
}

const EVENT_TYPES = [
  "user.login",
  "user.logout",
  "conversation.created",
  "conversation.deleted",
  "conversation.shared",
  "conversation.unshared",
  "message.sent",
  "message.received",
  "tool.invoked",
  "attachment.uploaded",
  "compaction.executed",
  "quota.exceeded",
  "mcp.server.connected",
]

function buildHref(sp: SearchParams, newOffset: number): string {
  const params = new URLSearchParams()
  if (sp.event_type) params.set("event_type", sp.event_type)
  if (sp.limit) params.set("limit", sp.limit)
  params.set("offset", String(newOffset))
  return `/admin/audit?${params.toString()}`
}
