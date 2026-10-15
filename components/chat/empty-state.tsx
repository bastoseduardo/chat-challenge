"use client"

import { Clock, FileText, Globe, NotebookPen, type LucideIcon } from "lucide-react"

interface Starter {
  icon: LucideIcon
  label: string
  /** Texto colocado no composer. Sem prompt, a ação abre o seletor de arquivo. */
  prompt?: string
}

// Cada atalho corresponde a uma ferramenta real do assistente.
const STARTERS: Starter[] = [
  {
    icon: Globe,
    label: "Pesquisar na web",
    prompt: "Quais foram as notícias de IA mais relevantes essa semana?",
  },
  { icon: FileText, label: "Resumir um PDF ou imagem" },
  {
    icon: NotebookPen,
    label: "Guardar uma nota",
    prompt: "Salva nas minhas notas: revisar o plano de UX amanhã",
  },
  { icon: Clock, label: "Ver o horário em outra cidade", prompt: "Que horas são agora em Lisboa?" },
]

export function EmptyState({
  onPrompt,
  onPickFiles,
}: {
  onPrompt: (text: string) => void
  onPickFiles: () => void
}) {
  return (
    <div className="pt-[12vh] pb-6">
      <h2 className="text-[26px] font-semibold leading-tight tracking-tight text-balance">
        Pergunte algo ou solte um PDF aqui
      </h2>
      <p className="mt-2 max-w-[52ch] text-muted-foreground">
        O assistente pesquisa na web, lê páginas, PDFs e imagens, e guarda notas pra você.
      </p>
      <ul className="mt-8 grid gap-1 sm:grid-cols-2">
        {STARTERS.map(({ icon: Icon, label, prompt }) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => (prompt ? onPrompt(prompt) : onPickFiles())}
              className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left hover:bg-accent transition-colors"
            >
              <Icon className="mt-0.5 size-[18px] shrink-0 text-tool" aria-hidden />
              <span className="min-w-0">
                <span className="block font-medium">{label}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {prompt ?? "Anexe um arquivo e peça um resumo"}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
