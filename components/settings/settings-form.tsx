"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

const ALL_TOOLS = [
  { id: "web_search", label: "Web search", description: "Pesquisa na web via Tavily" },
  { id: "web_scrape", label: "Web scrape", description: "Lê URLs via Jina Reader" },
  { id: "get_current_time", label: "Horário atual", description: "Retorna data e hora" },
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
            <div key={t.id} className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{t.label}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
              <Switch
                checked={tools.includes(t.id)}
                onCheckedChange={(v) => toggle(t.id, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCP servers (JSON)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Formato: {'{"servers":[{"name":"...","transport":"sse","config":{"url":"..."}}]}'}
          </p>
          <Textarea
            value={mcpConfig}
            onChange={(e) => setMcpConfig(e.target.value)}
            className="font-mono text-xs min-h-[160px]"
          />
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  )
}
