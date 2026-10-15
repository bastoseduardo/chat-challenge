"use client"

import { useSearchParams } from "next/navigation"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { succeeded } from "@/lib/conversations/store"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

const EVENT_TYPES = [
  "user.login",
  "user.logout",
  "conversation.created",
  "conversation.deleted",
  "conversation.restored",
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

interface AuditEvent {
  id: string
  created_at: string
  event_type: string
  user_id: string | null
  resource_type: string | null
  resource_id: string | null
  metadata: unknown
}

async function fetchAudit(eventType: string, offset: number, signal: AbortSignal) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
  if (eventType) params.set("event_type", eventType)
  const res = await fetch(`/api/admin/audit?${params}`, { signal })
  if (!succeeded(res)) throw new Error("Não foi possível carregar os eventos.")
  return (await res.json()) as { events: AuditEvent[]; total: number }
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

/**
 * Filtro e paginação mudam a URL via history.replaceState (sincroniza com
 * useSearchParams sem request RSC) e os dados vêm de /api/admin/audit.
 */
export function AuditLog() {
  const searchParams = useSearchParams()
  const eventType = searchParams.get("event_type") ?? ""
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0)

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ["audit", eventType, offset],
    queryFn: ({ signal }) => fetchAudit(eventType, offset, signal),
    placeholderData: keepPreviousData,
  })

  function update(next: { eventType?: string; offset?: number }) {
    const params = new URLSearchParams()
    const type = next.eventType ?? eventType
    const off = next.offset ?? offset
    if (type) params.set("event_type", type)
    if (off) params.set("offset", String(off))
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  const events = data?.events ?? []
  const total = data?.total ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="event-type" className="text-sm font-medium">
            Tipo de evento
          </label>
          <select
            id="event-type"
            value={eventType}
            onChange={(e) => update({ eventType: e.target.value, offset: 0 })}
            className="block h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Todos</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        {eventType && (
          <Button variant="ghost" size="sm" onClick={() => update({ eventType: "", offset: 0 })}>
            Limpar filtro
          </Button>
        )}
        <p className="ml-auto flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          {isFetching && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {total.toLocaleString("pt-BR")} eventos
        </p>
      </div>

      {isError ? (
        <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2.5 text-sm">
          {(error as Error).message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className={cn("w-full min-w-[860px] text-sm", isFetching && "opacity-70")}>
            <thead className="border-b bg-muted/60 text-left">
              <tr>
                <th className="w-36 px-3 py-2 font-medium">Quando</th>
                <th className="w-48 px-3 py-2 font-medium">Evento</th>
                <th className="w-28 px-3 py-2 font-medium">Usuário</th>
                <th className="w-52 px-3 py-2 font-medium">Recurso</th>
                <th className="px-3 py-2 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const meta = JSON.stringify(e.metadata)
                return (
                  <tr key={e.id} className="border-b align-top last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-muted-foreground">
                      {dateFmt.format(new Date(e.created_at))}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-medium">{e.event_type}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-muted-foreground">
                      {e.user_id ? e.user_id.slice(0, 8) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {e.resource_type ?? "—"}
                      {e.resource_id && (
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                          {e.resource_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <code className="line-clamp-2 break-all text-xs text-muted-foreground" title={meta}>
                        {meta}
                      </code>
                    </td>
                  </tr>
                )
              })}
              {!isFetching && events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    Nenhum evento {eventType ? "desse tipo" : "registrado"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0 || isFetching}
          onClick={() => update({ offset: Math.max(0, offset - PAGE_SIZE) })}
        >
          <ChevronLeft className="mr-1 size-4" />
          Anterior
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {from}–{to} de {total.toLocaleString("pt-BR")}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={offset + PAGE_SIZE >= total || isFetching}
          onClick={() => update({ offset: offset + PAGE_SIZE })}
        >
          Próxima
          <ChevronRight className="ml-1 size-4" />
        </Button>
      </div>
    </div>
  )
}
