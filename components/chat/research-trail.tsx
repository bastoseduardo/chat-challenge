"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ToolStep {
  key: string
  toolName: string
  state?: string
  input?: unknown
  output?: unknown
  errorText?: string
}

type Phase = "running" | "done" | "error"

function phaseOf(state?: string): Phase {
  if (state === "output-error") return "error"
  if (state === "output-available") return "done"
  return "running"
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function hostOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/**
 * Frase curta, do ponto de vista do usuário, pra cada chamada de ferramenta.
 * Ferramentas MCP chegam como "<servidor>__<tool>".
 */
function describe(step: ToolStep, phase: Phase): string {
  const input = (step.input ?? {}) as Record<string, unknown>
  const running = phase === "running"
  const [server, mcpTool] = step.toolName.includes("__")
    ? step.toolName.split("__")
    : [null, step.toolName]
  const tool = mcpTool ?? step.toolName

  switch (tool) {
    case "web_search": {
      const q = str(input.query)
      return `${running ? "Buscando" : "Buscou"} na web${q ? ` “${q}”` : ""}`
    }
    case "web_scrape": {
      const host = hostOf(str(input.url))
      return `${running ? "Lendo" : "Leu"} ${host ?? "uma página"}`
    }
    case "get_current_time": {
      const tz = str(input.timezone)
      return `${running ? "Consultando" : "Consultou"} o horário${tz ? ` em ${tz}` : ""}`
    }
    case "drive_search_files": {
      const q = str(input.query)
      return `${running ? "Buscando" : "Buscou"} no Drive${q ? ` “${q}”` : ""}`
    }
    case "drive_read_file":
      return `${running ? "Abrindo" : "Abriu"} um arquivo do Drive`
    case "save_note":
      return `${running ? "Salvando" : "Salvou"} uma nota`
    case "list_notes":
      return `${running ? "Listando" : "Listou"} suas notas`
    case "search_notes": {
      const q = str(input.query)
      return `${running ? "Procurando" : "Procurou"} nas notas${q ? ` “${q}”` : ""}`
    }
    default: {
      const name = tool.replace(/[_-]+/g, " ")
      const where = server ? ` (${server.replace(/[_-]+/g, " ")})` : ""
      return `${running ? "Usando" : "Usou"} ${name}${where}`
    }
  }
}

/** Rótulo do estado de espera ("Buscando na web…") pra região aria-live. */
export function activityLabel(step: ToolStep): string {
  return `${describe(step, "running")}…`
}

function format(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function Step({ step, index }: { step: ToolStep; index: number }) {
  const phase = phaseOf(step.state)
  const [open, setOpen] = useState(phase === "error")
  const hasDetail = step.input !== undefined || step.output !== undefined || !!step.errorText

  return (
    <li className="relative -ml-[10px] pl-7">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-[3px] grid place-items-center size-[18px] rounded-full text-[11px] font-semibold tabular-nums",
          phase === "error"
            ? "bg-destructive text-destructive-foreground"
            : "bg-tool-soft text-tool ring-1 ring-tool/40",
          phase === "running" && "animate-pulse"
        )}
      >
        {index + 1}
      </span>
      <button
        type="button"
        onClick={() => hasDetail && setOpen((v) => !v)}
        aria-expanded={hasDetail ? open : undefined}
        disabled={!hasDetail}
        className="group/step flex items-center gap-1 text-left text-sm text-muted-foreground enabled:hover:text-foreground transition-colors pointer-coarse:py-1.5"
      >
        <span className={cn(phase === "running" && "text-foreground")}>
          {describe(step, phase)}
          {phase === "running" && "…"}
        </span>
        {phase === "error" && <span className="text-destructive">, falhou</span>}
        {hasDetail && (
          <ChevronRight
            className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")}
          />
        )}
      </button>
      {open && hasDetail && (
        <div className="mt-1.5 mb-1 space-y-2 rounded-md border bg-code p-2.5 font-mono text-xs">
          {step.input !== undefined && (
            <section>
              <div className="mb-1 font-sans text-muted-foreground">Entrada</div>
              <pre className="whitespace-pre-wrap break-words">{format(step.input)}</pre>
            </section>
          )}
          {step.output !== undefined && (
            <section>
              <div className="mb-1 font-sans text-muted-foreground">Resultado</div>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                {format(step.output)}
              </pre>
            </section>
          )}
          {step.errorText && (
            <section>
              <div className="mb-1 font-sans text-destructive">Erro</div>
              <pre className="whitespace-pre-wrap break-words text-destructive">{step.errorText}</pre>
            </section>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Chamadas de ferramenta de uma resposta, como uma trilha numerada na margem.
 * Enquanto algo roda, fica aberta; concluída, recolhe pra uma linha.
 */
export function ResearchTrail({ steps, live }: { steps: ToolStep[]; live?: boolean }) {
  const anyRunning = steps.some((s) => phaseOf(s.state) === "running")
  const [expanded, setExpanded] = useState<boolean | null>(null)
  const isOpen = expanded ?? (live || anyRunning)
  const failed = steps.filter((s) => phaseOf(s.state) === "error").length
  const summary =
    `${steps.length} ${steps.length === 1 ? "passo" : "passos"} de pesquisa` +
    (failed ? `, ${failed} com erro` : "")

  return (
    <div className="my-3 font-sans">
      {!(live || anyRunning) && (
        <button
          type="button"
          onClick={() => setExpanded(!isOpen)}
          aria-expanded={isOpen}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors pointer-coarse:py-2"
        >
          <span aria-hidden className="h-3.5 w-0.5 rounded-full bg-tool" />
          {summary}
          <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
        </button>
      )}
      {isOpen && (
        <ol
          className={cn(
            "relative ml-[9px] space-y-1.5 border-l-2 border-tool/50",
            !(live || anyRunning) && "mt-2"
          )}
        >
          {steps.map((s, i) => (
            <Step key={s.key} step={s} index={i} />
          ))}
        </ol>
      )}
    </div>
  )
}
