"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Gera o PDF pelo diálogo de impressão do navegador (CSS @media print). */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} className="shrink-0 print:hidden">
      <Download className="mr-1.5 size-4" aria-hidden />
      <span className="hidden sm:inline">Baixar PDF</span>
      <span className="sm:hidden">PDF</span>
    </Button>
  )
}
