"use client"

import { useMemo, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { succeeded } from "@/lib/conversations/store"

const ALL_TOOLS = [
  { id: "web_search", label: "Pesquisar na web", description: "Busca resultados atuais (Tavily)", google: false },
  { id: "web_scrape", label: "Ler páginas", description: "Abre um link e lê o conteúdo (Jina Reader)", google: false },
  { id: "get_current_time", label: "Data e hora", description: "Consulta o horário em qualquer fuso", google: false },
  { id: "drive_search_files", label: "Buscar no Google Drive", description: "Lista e procura arquivos do seu Drive", google: true },
  { id: "drive_read_file", label: "Ler arquivos do Google Drive", description: "Lê Docs, Sheets e arquivos de texto", google: true },
]

interface Props {
  initial: {
    enabledTools: string[]
    mcpConfig: string
  }
}

/** Valida o JSON dos conectores e devolve uma mensagem com a linha do erro. */
function validateMcp(text: string): { value: Record<string, unknown> } | { error: string } {
  if (!text.trim()) return { value: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    const msg = err instanceof Error ? err.message : ""
    const pos = /position (\d+)/.exec(msg)
    if (pos) {
      const line = text.slice(0, Number(pos[1])).split("\n").length
      return { error: `JSON inválido perto da linha ${line}. Confira vírgulas, aspas e chaves.` }
    }
    return { error: "JSON inválido. Confira vírgulas, aspas e chaves." }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "A configuração precisa ser um objeto, começando com {." }
  }
  const servers = (parsed as { servers?: unknown }).servers
  if (servers !== undefined && !Array.isArray(servers)) {
    return { error: "\"servers\" precisa ser uma lista: [ ... ]." }
  }
  return { value: parsed as Record<string, unknown> }
}

export function SettingsForm({ initial }: Props) {
  const [tools, setTools] = useState<string[]>(initial.enabledTools)
  const [mcpConfig, setMcpConfig] = useState(initial.mcpConfig)
  const [saved, setSaved] = useState({ tools: initial.enabledTools, mcp: initial.mcpConfig })
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle")

  const mcp = useMemo(() => validateMcp(mcpConfig), [mcpConfig])
  const mcpError = "error" in mcp ? mcp.error : null
  const dirty =
    mcpConfig !== saved.mcp ||
    tools.length !== saved.tools.length ||
    tools.some((t) => !saved.tools.includes(t))

  function toggle(id: string, on: boolean) {
    setStatus("idle")
    setTools((prev) => (on ? [...new Set([...prev, id])] : prev.filter((t) => t !== id)))
  }

  async function save() {
    if ("error" in mcp) return
    setStatus("saving")
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabledTools: tools, mcpConfig: mcp.value }),
    }).catch(() => null)
    if (succeeded(res)) {
      setSaved({ tools, mcp: mcpConfig })
      setStatus("saved")
      setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000)
    } else {
      setStatus("idle")
      toast.error("Não foi possível salvar. Tente de novo.")
    }
  }

  function fillNotesServer() {
    setStatus("idle")
    setMcpConfig(
      JSON.stringify(
        {
          servers: [
            {
              name: "user-notes",
              transport: { type: "http", url: `${window.location.origin}/api/mcp/user-notes` },
            },
          ],
        },
        null,
        2
      )
    )
  }

  return (
    <div className="space-y-10">
      <section aria-labelledby="tools-heading" className="space-y-3">
        <div>
          <h2 id="tools-heading" className="font-semibold">
            Ferramentas
          </h2>
          <p className="text-sm text-muted-foreground">
            O que o assistente pode usar pra responder. Vale pra todas as conversas.
          </p>
        </div>
        <ul className="divide-y rounded-lg border">
          {ALL_TOOLS.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <label htmlFor={`tool-${t.id}`} className="min-w-0 cursor-pointer">
                <span className="block font-medium">{t.label}</span>
                <span className="block text-sm text-muted-foreground">
                  {t.description}
                  {t.google && " (precisa do login com Google)"}
                </span>
              </label>
              <Switch
                id={`tool-${t.id}`}
                checked={tools.includes(t.id)}
                onCheckedChange={(v) => toggle(t.id, v)}
              />
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Se uma ferramenta do Drive estiver ligada e mesmo assim falhar, saia e entre de novo
          com o Google pra renovar a permissão.
        </p>
      </section>

      <section aria-labelledby="mcp-heading" className="space-y-3">
        <div>
          <h2 id="mcp-heading" className="font-semibold">
            Conectores (MCP)
          </h2>
          <p className="text-sm text-muted-foreground">
            Servidores MCP externos adicionam ferramentas ao assistente. Informe em JSON, com
            transporte HTTP ou SSE.
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-end justify-between gap-3">
            <label htmlFor="mcp-config" className="text-sm font-medium">
              Configuração
            </label>
            <button
              type="button"
              onClick={fillNotesServer}
              className="text-sm text-primary underline underline-offset-4 hover:no-underline"
            >
              Usar o servidor de notas
            </button>
          </div>
          <textarea
            id="mcp-config"
            value={mcpConfig}
            spellCheck={false}
            aria-invalid={!!mcpError}
            aria-describedby="mcp-help"
            onChange={(e) => {
              setStatus("idle")
              setMcpConfig(e.target.value)
            }}
            placeholder={`{\n  "servers": [\n    {\n      "name": "exemplo",\n      "transport": { "type": "http", "url": "https://..." }\n    }\n  ]\n}`}
            className={cn(
              "block min-h-[200px] w-full resize-y rounded-md border border-input bg-code px-3 py-2.5 font-mono text-[13px] leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mcpError && "border-destructive focus-visible:ring-destructive"
            )}
          />
          <p
            id="mcp-help"
            className={cn("text-sm", mcpError ? "text-destructive" : "text-muted-foreground")}
            aria-live="polite"
          >
            {mcpError ?? "Deixe vazio pra não usar conectores externos."}
          </p>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3 border-t pt-5">
        {dirty && status === "idle" && (
          <span className="text-sm text-muted-foreground">Alterações não salvas</span>
        )}
        <Button onClick={save} disabled={!dirty || !!mcpError || status === "saving"}>
          {status === "saving" && <Loader2 className="mr-2 size-4 animate-spin" />}
          {status === "saved" && <Check className="mr-2 size-4" />}
          {status === "saving" ? "Salvando…" : status === "saved" ? "Salvo" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  )
}
