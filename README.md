# Chat Challenge

Aplicação de chat multi-conversa com integração a tools externas, suporte a imagens/PDFs,
compartilhamento read-only, auto-compactação de contexto, governança de uso e audit log.

> **Desafio técnico** — prazo 2026-10-15. Stack a critério do dev.

**🔗 Deploy:** `https://chat-challenge.vercel.app` _(preenche quando sair)_
**🎬 Vídeo:** _(preenche quando sair)_

---

## Features

### Requisitos obrigatórios ✅

| # | Requisito | Como atende |
|---|---|---|
| R1 | Múltiplas conversas + persistência | `conversations` + `messages` em Postgres, sidebar com rename/delete, histórico persistido entre sessões |
| R2 | Tools (internet + web scraping) | `web_search` (Tavily), `web_scrape` (Jina Reader) nativas; toggle on/off em `/settings` |
| R3 | Vision (imagens) | Upload direto pro Supabase Storage, injeção como content parts `type: "image"` nativos do Claude |
| R4 | PDFs no chat | Mesmo pipeline das imagens, `type: "file"` + `mediaType: "application/pdf"` (vision nativo) |
| R5 | Compartilhar conversa | Rota pública `/share/[token]` read-only via função Postgres `SECURITY DEFINER`, revogável |
| R6 | Deploy em cloud, link público | Vercel + GitHub, auto-deploy em push |
| R7 | Persistência completa | 11 tabelas: users, conversations, messages, attachments, tool_invocations, shares, usage_events, audit_events, user_settings, user_notes, profiles |
| R8 | Auto-compactação | Threshold 80% ctx window, summariza mensagens antigas em `role=system`/`is_summary=true`, roda em background via `after()`, badge "Comprimido Nx" na UI |
| R9 | Cap de tokens + contabilização | Pre-check por-usuário E global (env), bloqueia com 429 + modal "quota exceeded"; `usage_events` grava tokens + custo USD derivado |
| R10 | Audit log | Tabela `audit_events` + hooks em login/logout, conversation CRUD, message, tool, attachment, compaction, quota, mcp, share; UI em `/admin/audit` paginada e filtrável |

### Diferenciais ⭐

- **MCP (Model Context Protocol)** — client factory lê JSON config do usuário em `user_settings.mcp_config`,
  instancia `@ai-sdk/mcp` clients e mescla tools no `streamText`. Server MCP próprio em
  `/api/mcp/user-notes` (JSON-RPC 2.0 sobre HTTP, 3 tools: `save_note`, `list_notes`, `search_notes`).

---

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Framework | **Next.js 16** (App Router + Turbopack) | SSR + API routes no mesmo repo, auto-deploy no Vercel |
| LLM | **Claude Sonnet 4.6** via **AI SDK 7** | 200k ctx, vision nativo, tool-calling multi-step, streaming |
| DB | **Supabase Postgres** | Postgres sério, free tier generoso, dashboard pronto |
| ORM | **Drizzle** | Type-safe, migrations rápidas, schemaFilter pra ignorar `auth` |
| Auth | **Supabase Auth + Google OAuth** | 2 cliques no dashboard, access_token destrava connectors futuros |
| Storage | **Supabase Storage** | Mesma conta, bucket privado + signed URLs TTL 1h |
| Tools | **Tavily** (search) + **Jina Reader** (scrape) | 1k/mês free + sem key respectivamente |
| MCP | **@ai-sdk/mcp** | HTTP streamable transport, protocolo 2025-06-18 |
| Deploy | **Vercel** | Push → URL público, integração nativa com Supabase |

---

## Arquitetura

```
┌──────────────────────┐
│   Usuário (Browser)  │
└──────────┬───────────┘
           │ HTTPS
           ▼
┌──────────────────────┐
│  Chat App (Next.js)  │
│   on Vercel          │
└──────────┬───────────┘
           │
   ┌───────┼────────┐
   ▼       ▼        ▼
┌────────┐┌──────────────────┐┌──────────────────┐
│Claude  ││  Supabase        ││ Tool providers   │
│Sonnet  ││  Auth · PG · Blob││ Tavily · Jina ·  │
│        ││                  ││ MCP (user-notes) │
└────────┘└──────────────────┘└──────────────────┘
```

### Fluxo de uma mensagem

```
Client POST /api/chat { conversationId, messages, attachments[] }
  │
  ├─ 1. Autentica (Supabase SSR middleware)
  ├─ 2. Pre-check caps (user daily + global daily) → 429 se exceder
  ├─ 3. Carrega user_settings (enabled_tools + mcp_config)
  ├─ 4. Persiste user message + attachment rows + audit "message.sent"
  ├─ 5. buildContext(): last summary + msgs pós-corte, re-injeta anexos como file parts
  ├─ 6. Monta tools = builtins (filtered) + MCP (loaded from config)
  ├─ 7. streamText({ messages, tools, stopWhen: 5 steps })
  │
  ├─ onFinish:
  │   ├─ Persiste assistant message
  │   ├─ Atualiza totals na conversation
  │   ├─ Insere usage_event (tokens + custo USD)
  │   ├─ Persiste tool_invocations + audit "tool.invoked"
  │   ├─ Audit "message.received"
  │   ├─ scheduleCompaction() via after() → background
  │   └─ closeMcpClients()
  │
  └─ Retorna SSE stream pro client
```

### Schema do banco

11 tabelas em `public`, todas com RLS. Resumo:

- `profiles` — espelho de `auth.users` com `is_admin`
- `user_settings` — enabled_tools, mcp_config, default_model (por usuário)
- `conversations` — soft delete, totals de tokens, compaction_count
- `messages` — content JSONB (UI parts), is_summary para compactação
- `attachments` — storage_path + mime + kind, linkada à message
- `tool_invocations` — audit técnico de cada tool call
- `shares` — token nanoid 24 chars, revogável
- `usage_events` — tokens + cost_usd por LLM call (event_kind: chat/compaction/tool_llm)
- `audit_events` — eventos de negócio
- `user_notes` — exemplo MCP (notas pessoais)

**Share público** não usa RLS — expõe só `get_shared_conversation(token)` com `SECURITY DEFINER`.

---

## Setup local

### Pré-requisitos
- Node 20+ (recomendado 24 LTS)
- Conta Supabase, Anthropic API key, Tavily API key, GCP OAuth client

### Passos

```bash
git clone https://github.com/<user>/chat-challenge.git
cd chat-challenge
npm install
cp .env.local.example .env.local
# Edite .env.local com as credenciais reais

npm run check-env             # confirma todas 13 vars presentes
```

**No Supabase SQL Editor**, rode na ordem:
1. `drizzle/migrations/0000_init.sql`
2. `drizzle/sql/001_rls_policies.sql`
3. `drizzle/sql/002_profile_trigger.sql`
4. `drizzle/sql/003_share_function.sql`
5. `drizzle/sql/004_storage_bucket.sql`

**No Supabase dashboard**: `Authentication > Providers > Google` → habilita e cola Client ID + Secret do GCP.

**No GCP Console**: cria OAuth client (Web), adiciona `<supabase-url>/auth/v1/callback` em Authorized redirect URIs.

Depois:

```bash
npm run dev           # http://localhost:3000
```

### Variáveis de ambiente

Veja `.env.local.example`. Todas obrigatórias (check-env valida).

---

## Testando o MCP

1. Vá em `/settings`
2. Clique em **"Preencher com o server user-notes"** → **Salvar**
3. Em uma conversa, peça: _"Salve nas minhas notas: X"_, depois _"Lista minhas notas"_
4. Veja em `/admin/audit` os eventos `mcp.server.connected` + `tool.invoked` (tool_source=mcp)

Para adicionar servers MCP externos, cole o JSON no formato:

```json
{
  "servers": [
    {
      "name": "exemplo",
      "transport": {
        "type": "http",
        "url": "https://..."
      }
    }
  ]
}
```

---

## Decisões técnicas (ADRs resumidos)

- **Supabase sobre Neon+Auth.js+Blob** — 3 serviços em 1, elimina Vercel Blob e Auth.js, mantém RLS nativo.
- **Drizzle sobre Prisma** — migrations rápidas, SQL explícito, `schemaFilter: ['public']` isola `auth`.
- **PDF via vision nativo** — bytes direto pro Claude (não parse local), preserva diagramas/tabelas em troca de mais tokens.
- **Compaction por summary** — vs sliding window: preserva contexto decisivo. Prompt pede marcações em markdown (Decisões, Fatos, Pendências).
- **MCP via config JSON** — vs UI de gerência: 1h de dev, cobre o diferencial sem explodir escopo.
- **Share via função PG `SECURITY DEFINER`** — vs policies RLS complexas por token: superfície controlada, campos safe.
- **Audit em Postgres (não Supabase Logs)** — permite query/UI de negócio direto na app.
- **Caches de tokens** — pre-check otimista com margem 5%, aceita over-count mínimo (sem advisory locks).

---

## Estrutura de pastas

```
app/
├── (routes)/
│   ├── login/, auth/, c/, share/, settings/, usage/, admin/
│   └── api/
│       ├── chat/                      # streaming principal
│       ├── conversations/[...]
│       ├── attachments/[...]
│       ├── admin/audit/
│       ├── settings/
│       └── mcp/user-notes/            # server MCP próprio
├── layout.tsx, page.tsx
components/
├── chat/                              # ChatView, Sidebar, Composer, Message, Share, Attachments
├── settings/                          # SettingsForm
└── ui/                                # shadcn components
lib/
├── ai/                                # client, tools, mcp, compaction, history, tokens
├── db/                                # schema, client, queries
├── storage/                           # signed URLs, attachment helpers
├── supabase/                          # server/browser/service clients + middleware
├── audit/, usage/, auth/
drizzle/
├── migrations/0000_init.sql
└── sql/{001_rls,002_trigger,003_share_fn,004_storage}.sql
docs/
├── 00-discovery.md
├── 01-prd.md
├── 02-architecture.md
└── specs/SPEC-00[1-7]-*.md
scripts/check-env.ts
proxy.ts                               # Next 16 (ex-middleware.ts)
```

---

## Scripts

```bash
npm run dev              # dev server
npm run build            # production build
npm run start            # production run
npm run check-env        # valida vars .env.local
npm run db:generate      # drizzle-kit generate
npm run db:migrate       # drizzle-kit migrate
npm run db:studio        # drizzle-kit studio (UI do banco)
```

---

## Licença

MIT.
