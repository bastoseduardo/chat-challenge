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
import { Textarea } from "@/components/ui/textarea"
import { Settings2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { MODELS } from "@/lib/ai/pricing"
import { cn } from "@/lib/utils"

interface Props {
  conversationId: string
  initialModel: string
  initialSystemPrompt: string | null
}

export function ConversationSettings({
  conversationId,
  initialModel,
  initialSystemPrompt,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [model, setModel] = useState(initialModel)
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt ?? "")
  const [saving, setSaving] = useState(false)

  // Reseta ao reabrir (caso a conversa mude por outra ação)
  useEffect(() => {
    if (open) {
      setModel(initialModel)
      setSystemPrompt(initialSystemPrompt ?? "")
    }
  }, [open, initialModel, initialSystemPrompt])

  async function save() {
    setSaving(true)
    const res = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        systemPrompt: systemPrompt.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success("Configurações salvas")
      setOpen(false)
      router.refresh()
    } else {
      toast.error("Erro ao salvar")
    }
  }

  const hasChanges =
    model !== initialModel ||
    (systemPrompt.trim() || null) !== (initialSystemPrompt?.trim() || null)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Configurações da conversa"
      >
        <Settings2 className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações da conversa</DialogTitle>
            <DialogDescription>
              Modelo e instruções do sistema aplicam-se somente a essa conversa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <section className="space-y-2">
              <label className="text-sm font-medium">Modelo</label>
              <div className="space-y-1.5">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModel(m.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md border transition-colors",
                      model === m.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{m.label}</span>
                      {model === m.id && (
                        <span className="text-[10px] uppercase tracking-wider text-primary">
                          selecionado
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <label className="text-sm font-medium">Instruções do sistema (opcional)</label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Ex: Você é um advogado tributarista brasileiro. Responda sempre citando artigos de lei quando aplicável."
                className="min-h-[120px] text-sm"
                maxLength={10_000}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Enviado como system message a cada request.</span>
                <span>{systemPrompt.length}/10000</span>
              </div>
            </section>

            <div className="flex gap-2 justify-end border-t pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={!hasChanges || saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Salvando
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
