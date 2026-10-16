"use client"

import { ArrowRight, Globe, NotebookPen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StarterList } from "@/components/chat/empty-state"
import { SAMPLE_PROMPT } from "@/lib/demo/sample-prompt"

const POINTS = [
  { icon: Globe, text: "Busca na web e lê as páginas, PDFs e imagens que você manda." },
  { mark: "1", text: "Cada trecho da resposta aponta pra fonte de onde veio." },
  { icon: NotebookPen, text: "O que for útil vai pro caderno, com a fonte junto." },
] as const

/**
 * Primeira tela de quem ainda não tem conversas (SPEC-R4-010): diz o que o
 * Seshat faz e roda uma pesquisa de exemplo de verdade.
 */
export function Welcome({
  onSample,
  onPrompt,
  onPickFiles,
}: {
  onSample: () => void
  onPrompt: (text: string) => void
  onPickFiles: () => void
}) {
  return (
    <div className="pt-[3vh] pb-6 sm:pt-[6vh]">
      <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-balance sm:text-[32px]">
        Pesquise com as fontes à vista.
      </h2>
      <p className="mt-2 max-w-[56ch] text-muted-foreground">
        O Seshat busca, lê e cita de onde veio cada informação. O que for útil, você guarda no
        caderno.
      </p>

      <ul className="mt-6 space-y-2.5">
        {POINTS.map((p) => (
          <li key={p.text} className="flex items-start gap-3 text-[15px]">
            {"mark" in p ? (
              <span
                aria-hidden
                className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-sm bg-tool-soft text-[11px] font-semibold text-tool ring-1 ring-tool/40"
              >
                {p.mark}
              </span>
            ) : (
              <p.icon className="mt-0.5 size-[18px] shrink-0 text-tool" aria-hidden />
            )}
            {p.text}
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-lg border bg-card p-4 sm:p-5">
        <Button size="lg" onClick={onSample} className="w-full sm:w-auto">
          Ver uma pesquisa de exemplo
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        <p className="mt-3 border-l-2 border-tool/60 pl-3 font-serif text-[15px] italic text-foreground/85">
          {SAMPLE_PROMPT}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Envia essa pergunta de verdade. A resposta leva uns 30 segundos.
        </p>
      </div>

      <p className="mt-8 px-3 text-sm font-medium text-muted-foreground">Ou comece por aqui</p>
      <StarterList className="mt-1" onPrompt={onPrompt} onPickFiles={onPickFiles} />
    </div>
  )
}
