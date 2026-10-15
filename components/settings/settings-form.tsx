"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const ALL_TOOLS = [
  { id: "web_search", label: "Web search", description: "Pesquisa na web via Tavily", requiresConsent: false },
  { id: "web_scrape", label: "Web scrape", description: "Lê URLs via Jina Reader", requiresConsent: false },
  { id: "get_current_time", label: "Horário atual", description: "Retorna data e hora", requiresConsent: false },
  { id: "drive_search_files", label: "Google Drive · Buscar", description: "Lista arquivos do seu Drive", requiresConsent: true },
  { id: "drive_read_file", label: "Google Drive · Ler", description: "Lê conteúdo de Docs/Sheets/texto", requiresConsent: true },
]

interface Props {
  initial: {
    enabledTools: string[]
    mcpConfig: string
  }
}

export function SettingsForm({ initial }: Props) {
  const [tools, setTools] = useState<string[]>(initial.enabledTools)
  const [mcpConfig, setMcpConfig] = useState(initial.mcpConfig)
  const [saving, setSaving] = useState(false)

  function toggle(id: string, on: boolean) {
    setTools((prev) =>
      on ? [...new Set([...prev, id])] : prev.filter((t) => t !== id)
    )
  }

  async function save() {
    let parsedMcp: unknown = {}
    try {
      parsedMcp = mcpConfig.trim() ? JSON.parse(mcpConfig) : {}
    } catch {
      toast.error("MCP config: JSON inválido")
      return
    }
    setSaving(true)
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabledTools: tools, mcpConfig: parsedMcp }),
    })
    setSaving(false)
    if (res.ok) toast.success("Salvo")
    else toast.error("Erro ao salvar")
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tools built-in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ALL_TOOLS.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm flex items-center gap-2">
                  {t.label}
                  {t.requiresConsent && (
                    <span className="text-xs text-tool bg-tool-soft px-1.5 py-0.5 rounded-sm">
                      Requer consentimento
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
              <Switch
                checked={tools.includes(t.id)}
                onCheckedChange={(v) => toggle(t.id, v)}
              />
            </div>
          ))}
          <p className="text-xs text-muted-foreground pt-2 border-t">
            As tools do Google Drive precisam de scope <code>drive.readonly</code>.
            Se o toggle estiver ligado mas a tool falhar, faça logout e login novamente
            para reautorizar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCP servers (JSON)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Model Context Protocol — adicione servers HTTP ou SSE. Para o server interno
            de notas, use o exemplo abaixo:
          </p>
          <button
            type="button"
            onClick={() => {
              const appUrl =
                typeof window !== "undefined"
                  ? window.location.origin
                  : ""
              setMcpConfig(
                JSON.stringify(
                  {
                    servers: [
                      {
                        name: "user-notes",
                        transport: {
                          type: "http",
                          url: `${appUrl}/api/mcp/user-notes`,
                        },
                      },
                    ],
                  },
                  null,
                  2
                )
              )
            }}
            className="text-xs underline text-primary"
          >
            Preencher com o server &quot;user-notes&quot; (notas pessoais)
          </button>
          <Textarea
            value={mcpConfig}
            onChange={(e) => setMcpConfig(e.target.value)}
            className="font-mono text-xs min-h-[180px]"
            placeholder={`{\n  "servers": [\n    {\n      "name": "exemplo",\n      "transport": {\n        "type": "http",\n        "url": "https://..."\n      }\n    }\n  ]\n}`}
          />
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  )
}
