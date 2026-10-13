"use client"

import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, BarChart3 } from "lucide-react"

interface QuotaDialogProps {
  open: boolean
  scope: string
  onOpenChange: (open: boolean) => void
}

export function QuotaDialog({ open, scope, onOpenChange }: QuotaDialogProps) {
  const isGlobal = scope === "global"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="w-5 h-5" />
            <DialogTitle>Limite diário atingido</DialogTitle>
          </div>
          <DialogDescription>
            {isGlobal
              ? "O limite global de tokens da aplicação foi atingido para hoje. Isso é um cap de segurança compartilhado por todos os usuários — ele reseta à meia-noite UTC."
              : "Você atingiu seu limite diário de tokens. O limite reseta à meia-noite UTC."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Link href="/usage" onClick={() => onOpenChange(false)}>
            <Button>
              <BarChart3 className="w-4 h-4 mr-2" />
              Ver meu uso
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
