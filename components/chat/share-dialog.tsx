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
import { Copy, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface ShareDialogProps {
  conversationId: string
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ShareDialog({ conversationId, open, onOpenChange }: ShareDialogProps) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetch(`/api/conversations/${conversationId}/share`)
      .then((r) => r.json())
      .then((d) => setToken(d.token ?? null))
  }, [open, conversationId])

  async function create() {
    setLoading(true)
    const res = await fetch(`/api/conversations/${conversationId}/share`, {
      method: "POST",
    })
    const data = await res.json()
    setLoading(false)
    if (data.token) setToken(data.token)
    else toast.error("Erro ao gerar link")
  }

  async function revoke() {
    setLoading(true)
    const res = await fetch(`/api/conversations/${conversationId}/share`, {
      method: "DELETE",
    })
    setLoading(false)
    if (res.ok) {
      setToken(null)
      toast.success("Compartilhamento revogado")
    }
  }

  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${token}` : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar conversa</DialogTitle>
          <DialogDescription>
            Qualquer pessoa com o link verá a conversa em modo somente leitura. Novas mensagens aparecem ao recarregar.
          </DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(url)
                  toast.success("Link copiado")
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="destructive"
              onClick={revoke}
              disabled={loading}
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Revogar link
            </Button>
          </div>
        ) : (
          <Button onClick={create} disabled={loading} className="w-full">
            Gerar link de compartilhamento
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
