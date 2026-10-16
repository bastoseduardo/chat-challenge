"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { succeeded } from "@/lib/conversations/store"
import { markTour } from "@/lib/demo/tour"

interface ShareDialogProps {
  conversationId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

type Busy = "create" | "regenerate" | "revoke" | null

export function ShareDialog({ conversationId, open, onOpenChange }: ShareDialogProps) {
  const [token, setToken] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)

  useEffect(() => {
    if (!open) return
    void fetch(`/api/conversations/${conversationId}/share`)
      .then((r) => r.json())
      .then((d) => {
        setToken(d.token ?? null)
        setSummary(d.summary ?? null)
      })
      .catch(() => {})
  }, [open, conversationId])

  async function create(regenerate = false) {
    setBusy(regenerate ? "regenerate" : "create")
    const res = await fetch(
      `/api/conversations/${conversationId}/share${regenerate ? "?regenerate=1" : ""}`,
      { method: "POST" }
    ).catch(() => null)
    const data = succeeded(res) ? await res.json() : null
    setBusy(null)
    if (!data?.token) {
      toast.error("Não foi possível gerar o link. Tente de novo.")
      return
    }
    setToken(data.token)
    setSummary(data.summary ?? null)
    markTour("share")
    if (data.summaryError === "quota") {
      toast.info("Resumo não gerado: a cota diária de uso acabou. O link funciona normalmente.")
    } else if (data.summaryError === "rate_limited") {
      toast.info("Muitos resumos seguidos. Espere um minuto pra gerar de novo.")
    } else if (!data.summary) {
      toast.info("Link criado. O resumo não pôde ser gerado agora.")
    }
  }

  async function revoke() {
    setBusy("revoke")
    const res = await fetch(`/api/conversations/${conversationId}/share`, {
      method: "DELETE",
    }).catch(() => null)
    setBusy(null)
    if (succeeded(res)) {
      setToken(null)
      setSummary(null)
      toast.success("Link revogado")
    } else {
      toast.error("Não foi possível revogar. Tente de novo.")
    }
  }

  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${token}` : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartilhar como relatório</DialogTitle>
          <DialogDescription>
            Quem tiver o link vê um relatório somente leitura: resumo, conversa e fontes. Dá pra
            baixar em PDF.
          </DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <label htmlFor="share-url" className="sr-only">
                Link do relatório
              </label>
              <Input id="share-url" readOnly value={url} className="font-mono text-xs" />
              <Button
                size="icon"
                variant="outline"
                aria-label="Copiar link"
                onClick={() => {
                  void navigator.clipboard.writeText(url)
                  toast.success("Link copiado")
                }}
              >
                <Copy className="size-4" />
              </Button>
              <Button size="icon" variant="outline" asChild>
                <a href={url} target="_blank" rel="noreferrer" aria-label="Abrir relatório">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>

            <section aria-labelledby="share-summary-heading" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id="share-summary-heading" className="text-sm font-medium">
                  Resumo do relatório
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void create(true)}
                  disabled={busy !== null}
                >
                  {busy === "regenerate" ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 size-3.5" />
                  )}
                  {summary ? "Gerar de novo" : "Gerar resumo"}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto whitespace-pre-line rounded-md border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
                {busy === "regenerate"
                  ? "Escrevendo o resumo…"
                  : summary ?? "Sem resumo. O relatório abre direto na conversa."}
              </div>
            </section>

            <Button
              variant="outline"
              onClick={() => void revoke()}
              disabled={busy !== null}
              className="w-full text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 size-4" />
              Revogar link
            </Button>
          </div>
        ) : (
          <Button onClick={() => void create()} disabled={busy !== null} className="w-full">
            {busy === "create" && <Loader2 className="mr-2 size-4 animate-spin" />}
            {busy === "create" ? "Gerando link e resumo…" : "Gerar link do relatório"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
