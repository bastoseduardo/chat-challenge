"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Archive, Zap, Loader2, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  COMPACTION_THRESHOLD,
  CONTEXT_WINDOW,
  statsKey,
  succeeded,
  type ConversationStats,
} from "@/lib/conversations/store"

interface Props {
  conversationId: string
  initialTotalTokens: number
  initialCompactionCount: number
}

async function fetchStats(conversationId: string): Promise<ConversationStats> {
  const res = await fetch(`/api/conversations/${conversationId}/compactions`)
  if (!succeeded(res)) throw new Error("Falha ao carregar o contexto")
  const data = await res.json()
  return {
    totalTokens: data.totalInputTokens + data.totalOutputTokens,
    compactionCount: data.compactionCount ?? 0,
    events: data.events ?? [],
  }
}

// O uso é atualizado pelo ChatView a cada resposta (metadata do stream) e
// reconciliado com o banco só quando o diálogo abre ou depois de uma
// compactação — sem polling.
export function ContextIndicator({
  conversationId,
  initialTotalTokens,
  initialCompactionCount,
}: Props) {
  const ctxWindow = CONTEXT_WINDOW
  const threshold = COMPACTION_THRESHOLD
  const [open, setOpen] = useState(false)
  const [forcing, setForcing] = useState(false)

  const { data, refetch } = useQuery({
    queryKey: statsKey(conversationId),
    queryFn: () => fetchStats(conversationId),
    initialData: {
      totalTokens: initialTotalTokens,
      compactionCount: initialCompactionCount,
      events: [],
    },
    staleTime: Infinity,
  })
  const { totalTokens, compactionCount, events } = data

  function openDialog() {
    setOpen(true)
    void refetch()
  }

  async function forceCompact() {
    setForcing(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/compact`, {
        method: "POST",
      })
      const result = await res.json()
      if (result.compacted) {
        toast.success("Histórico comprimido")
        await refetch()
      } else {
        toast.info(reasonLabel(result.reason))
      }
    } catch {
      toast.error("Não foi possível comprimir. Tente de novo.")
    }
    setForcing(false)
  }

  const pct = Math.min(100, Math.round((totalTokens / ctxWindow) * 100))
  const thresholdPct = threshold * 100
  const near = pct >= thresholdPct * 0.75
  const over = pct >= thresholdPct

  const barColor = over
    ? "bg-destructive"
    : near
    ? "bg-warning"
    : "bg-primary"

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex items-center gap-2 text-xs hover:bg-accent px-2 py-1 rounded transition-colors"
        title="Ver detalhes do contexto"
        aria-label={`Contexto usado: ${pct}%`}
      >
        <div className="hidden sm:block w-24 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono tabular-nums text-muted-foreground">
          {pct}%
        </span>
        {compactionCount > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5">
            <Archive className="w-3 h-3 mr-1" />
            {compactionCount}
          </Badge>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              Contexto da conversa
            </DialogTitle>
            <DialogDescription>
              Como o chat gerencia o limite do modelo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <section>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Uso de contexto</span>
                <span className="font-mono">
                  {totalTokens.toLocaleString("pt-BR")} / {ctxWindow.toLocaleString("pt-BR")} tokens ({pct}%)
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                <div
                  className={cn("h-full transition-all", barColor)}
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-foreground/40"
                  style={{ left: `${thresholdPct}%` }}
                  title={`Trigger de compactação em ${thresholdPct}%`}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                A compactação dispara automaticamente ao passar de{" "}
                <strong>{thresholdPct}%</strong>.
              </p>
            </section>

            <section className="space-y-2">
              <div className="text-sm font-medium">
                Compactações: {compactionCount}
              </div>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma compactação ainda. Quando acontecer, as mensagens antigas
                  serão resumidas e preservarão as decisões/fatos chave.
                </p>
              ) : (
                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                  {events.map((e, i) => (
                    <li key={i} className="text-xs flex justify-between gap-2 border-b pb-1.5 last:border-b-0">
                      <span className="text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("pt-BR")}
                      </span>
                      <span className="font-mono">
                        {e.metadata.messages_summarized} msgs
                        {e.metadata.forced && (
                          <Badge variant="outline" className="ml-1.5 h-4 text-[9px]">
                            manual
                          </Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pt-2 border-t">
              <Button
                onClick={forceCompact}
                disabled={forcing}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {forcing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Comprimindo...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-2" />
                    Comprimir agora
                  </>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Força a compactação mesmo antes de atingir o threshold. Útil pra demo
                ou pra renovar o contexto manualmente.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function reasonLabel(reason?: string): string {
  if (reason === "below_threshold")
    return "Ainda abaixo do limite. Use o botão 'Comprimir agora' pra forçar"
  if (reason === "not_enough_messages")
    return "Poucas mensagens pra comprimir"
  return "Nada pra fazer"
}
