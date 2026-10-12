# SPEC-003 — Tools & MCP

**User stories:** US-010, US-011, US-012, US-013, US-014
**Dependências:** SPEC-001
**Estimativa:** ~5h (built-in: 2h, MCP: 2h, Drive opcional: 1h)

## Objetivo
Modelo decide invocar tools built-in (`web_search` via Tavily, `web_scrape` via Jina, `get_current_time`) + servers MCP configurados pelo user via JSON em settings.

## Acceptance criteria

- [ ] AC-1 Tools built-in registradas no AI SDK e disponíveis por padrão.
- [ ] AC-2 Toggle on/off por usuário em `/settings` persiste em `user_settings.enabled_tools`.
- [ ] AC-3 Tool call é visível na UI (card com nome da tool + args + resultado colapsável).
- [ ] AC-4 Cada tool call é persistida em `tool_invocations` com duração.
- [ ] AC-5 `web_search` retorna títulos+snippets+URLs do Tavily; modelo cita no texto.
- [ ] AC-6 `web_scrape` chama `https://r.jina.ai/<url>` e retorna markdown.
- [ ] AC-7 `get_current_time` retorna ISO datetime + timezone.
- [ ] AC-8 MCP: user cola JSON em `user_settings.mcp_config`; servers aparecem como tools no próximo chat.
- [ ] AC-9 Um MCP server próprio (`mcp-servers/user-notes/`) está rodando e integrado no demo.
- [ ] AC-10 Erros de tool não quebram o chat (reportam ao modelo que tenta de novo ou explica).

## Modelo de dados
`user_settings.enabled_tools`, `user_settings.mcp_config`, `tool_invocations` (ver arquitetura).

## Tools built-in — contratos

### web_search
```ts
input:  { query: string, max_results?: number (default 5) }
output: { results: Array<{ title, url, snippet, published_date? }> }
provider: Tavily POST https://api.tavily.com/search
```

### web_scrape
```ts
input:  { url: string }
output: { url, markdown: string, title?: string }
provider: GET https://r.jina.ai/{encodeURIComponent(url)}
```

### get_current_time
```ts
input:  { timezone?: string }
output: { iso: string, timezone: string }
```

## MCP integration

```ts
// lib/ai/mcp.ts
import { experimental_createMCPClient } from 'ai'

export async function loadMcpTools(mcpConfig) {
  const tools = {}
  for (const server of mcpConfig.servers ?? []) {
    const client = await experimental_createMCPClient({
      transport: server.transport, // 'sse' | 'stdio'
      ...server.config,
    })
    Object.assign(tools, await client.tools())
  }
  return tools
}
```

### Config JSON (exemplo em settings)
```json
{
  "servers": [
    {
      "name": "user-notes",
      "transport": "sse",
      "config": { "url": "https://chat-challenge.vercel.app/api/mcp/user-notes" }
    }
  ]
}
```

### MCP server próprio: `user-notes`
Operações: `save_note(text)`, `list_notes()`, `search_notes(query)`.
Armazenamento: tabela `user_notes (id, user_id, content, created_at)` (adicionar ao schema).

## Componentes
- `<SettingsTools/>` — switches on/off
- `<SettingsMcp/>` — textarea JSON + validação
- `<ToolCallCard/>` — na thread, mostra tool executada

## Tasks

1. [ ] `lib/ai/tools/web-search.ts` + env `TAVILY_API_KEY`
2. [ ] `lib/ai/tools/web-scrape.ts`
3. [ ] `lib/ai/tools/get-current-time.ts`
4. [ ] Integrar `tools` no `streamText` do `/api/chat`
5. [ ] Persistir `tool_invocations` no onFinish
6. [ ] Settings page: toggle + save
7. [ ] UI card de tool call na mensagem
8. [ ] `lib/ai/mcp.ts` com client factory
9. [ ] Settings page: JSON config MCP
10. [ ] `mcp-servers/user-notes/` server (SSE endpoint)
11. [ ] Migration `user_notes`
12. [ ] (P2) Drive connector — se sobrar tempo

## Riscos
- **MCP SSE em serverless (Vercel)** → se streaming não aguentar, fallback pra tools HTTP simples sem protocolo MCP.
- **Tavily rate limit** → cachear últimas 5 queries em memória por sessão (dev).

## #PATH_DECISION
MCP server próprio hospedado no mesmo deploy (`/api/mcp/user-notes`) via SSE. Zero infra extra, demonstra MCP end-to-end.
