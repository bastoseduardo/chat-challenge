"use client"

import { useState } from "react"
import { Check, ChevronDown, Compass, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { dismissTour, setTourCollapsed, TOUR_STEPS, useTour, type TourStep } from "@/lib/demo/tour"

const LABELS: Record<TourStep, { pointer: string; touch: string }> = {
  citation: {
    pointer: "Passe o mouse num [1] pra ver o trecho citado",
    touch: "Toque num [1] pra ver o trecho citado",
  },
  trail: {
    pointer: "Abra a trilha de pesquisa",
    touch: "Abra a trilha de pesquisa",
  },
  note: {
    pointer: "Selecione uma frase e guarde no caderno",
    touch: "Selecione uma frase e guarde no caderno",
  },
  share: {
    pointer: "Compartilhe e abra o relatório",
    touch: "Compartilhe e abra o relatório",
  },
}

/**
 * "O que observar" (SPEC-R4-010): canto inferior direito da área da conversa,
 * sem cobrir o composer. Os itens se marcam sozinhos (`markTour`). No celular
 * começa recolhido, como um botão pequeno.
 */
export function TourPanel() {
  const tour = useTour()
  const [touch] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches
  )
  // Abaixo de ~1400 px o cartão cobriria o texto da resposta: começa recolhido.
  const [narrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1399px)").matches
  )
  if (!tour || tour.dismissed) return null

  const doneCount = TOUR_STEPS.filter((s) => tour.done.includes(s)).length
  const allDone = doneCount === TOUR_STEPS.length
  const collapsed = tour.collapsed ?? narrow

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setTourCollapsed(false)}
        aria-label={`O que observar: ${doneCount} de ${TOUR_STEPS.length} vistos. Abrir`}
        className="absolute bottom-3 right-3 z-10 inline-flex h-11 items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm font-medium shadow-md hover:bg-accent md:h-9"
      >
        <Compass className="size-4 text-tool" aria-hidden />
        <span className="hidden sm:inline">O que observar</span>
        <span className="tabular-nums text-muted-foreground">
          {doneCount}/{TOUR_STEPS.length}
        </span>
      </button>
    )
  }

  return (
    <section
      aria-labelledby="tour-title"
      className="absolute bottom-3 right-3 z-10 w-[min(18rem,calc(100%-1.5rem))] rounded-lg border bg-card p-3.5 font-sans shadow-lg"
    >
      <div className="flex items-center gap-2">
        <Compass className="size-4 text-tool" aria-hidden />
        <h2 id="tour-title" className="flex-1 text-sm font-semibold">
          O que observar
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {doneCount}/{TOUR_STEPS.length}
        </span>
        <button
          type="button"
          onClick={() => setTourCollapsed(true)}
          aria-label="Recolher"
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground pointer-coarse:size-9"
        >
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </div>

      <ol className="mt-2.5 space-y-2">
        {TOUR_STEPS.map((step) => {
          const done = tour.done.includes(step)
          return (
            <li key={step} className="flex items-start gap-2.5 text-sm">
              <span
                aria-hidden
                className={cn(
                  "mt-px grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors",
                  done ? "border-tool bg-tool text-background" : "border-muted-foreground/50"
                )}
              >
                {done && <Check className="size-3" strokeWidth={3} />}
              </span>
              <span className={cn(done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                {LABELS[step][touch ? "touch" : "pointer"]}
                <span className="sr-only">{done ? " (feito)" : " (pendente)"}</span>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2.5">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {allDone ? "Pronto, você viu tudo." : ""}
        </p>
        <button
          type="button"
          onClick={dismissTour}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground pointer-coarse:py-2"
        >
          <X className="size-3.5" aria-hidden />
          Dispensar
        </button>
      </div>
    </section>
  )
}
