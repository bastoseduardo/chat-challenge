# Arquitetura — Chat Challenge

**Ref:** [00-discovery.md](./00-discovery.md) · [01-prd.md](./01-prd.md)

---

## 1. C4 — Nível 1 (System Context)

```
                       ┌──────────────────────┐
                       │   Usuário (Browser)  │
                       └──────────┬───────────┘
                                  │ HTTPS
                                  ▼
                       ┌──────────────────────┐
   ┌───────────────────│  Chat App (Next.js)  │───────────────────┐
   │                   │   deployed on Vercel │                   │
   │                   └──────────┬───────────┘                   │
   │                              │                               │
   ▼                              ▼                               ▼
┌────────────┐          ┌──────────────────┐          ┌───────────────────┐
│ Anthropic  │          │     Supabase     │          │  Tool providers   │
│  Claude    │          │ Auth · PG · Blob │          │ Tavily · Jina ·   │
│ (Sonnet)   │          │                  │          │ MCP servers       │
└────────────┘          └──────────────────┘          └───────────────────┘
```

**Boundary:** tudo roda server-side (Next.js API routes + Server Actions). Nenhuma chave trafega pro browser.

---

## 2. Arquitetura interna (Next.js)

```
app/
├── (auth)/
│   ├── login/page.tsx                 # Google OAuth entry
│   └── callback/route.ts              # Supabase auth callback
├── (app)/
│   ├── layout.tsx                     # Protegido (middleware)
│   ├── page.tsx                       # Lista de conversas + redirect
│   ├── c/[id]/page.tsx                # Chat UI
│   ├── settings/page.tsx              # Tools toggle + MCP config
│   └── usage/page.tsx                 # Painel de consumo
├── admin/
│   └── audit/page.tsx                 # Audit log view
├── share/
│   └── [token]/page.tsx               # Público read-only
└── api/
    ├── chat/route.ts                  # POST streaming
    ├── conversations/
    │   ├── route.ts                   # list, create
    │   └── [id]/
    │       ├── route.ts               # get, update, delete
    │       └── share/route.ts         # POST / DELETE
    ├── attachments/upload/route.ts    # signed URL + register
    ├── compaction/trigger/route.ts    # internal
    └── mcp/health/route.ts            # list configured servers

lib/
├── ai/
│   ├── client.ts                      # AI SDK + modelo
│   ├── tools/
│   │   ├── web-search.ts              # Tavily
│   │   ├── web-scrape.ts              # Jina Reader
│   │   └── get-current-time.ts
│   ├── mcp.ts                         # MCP client factory
│   └── compaction.ts                  # resumir histórico
├── db/
│   ├── schema.ts                      # Drizzle schema
│   ├── client.ts                      # pg client (service role)
│   └── queries/                       # funções typesafe
├── supabase/
│   ├── server.ts                      # SSR client
│   ├── browser.ts                     # CSR client
│   └── middleware.ts
├── usage/
│   ├── counter.ts                     # add_usage() atomic
│   ├── pricing.ts                     # token → USD
│   └── caps.ts                        # checkCap()
└── audit/
    └── log.ts                         # logEvent()

drizzle/
└── migrations/                        # SQL versionadas

mcp-servers/
└── user-notes/                        # MCP server próprio pro demo
    └── index.ts
```

---

## 3. Schema do Postgres

```sql
-- auth.users é gerenciado pelo Supabase Auth.

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table user_settings (
  user_id        uuid primary key references profiles(id) on delete cascade,
  enabled_tools  text[] not null default array['web_search','web_scrape','get_current_time'],
  mcp_config     jsonb not null default '{}'::jsonb,  -- { servers: [{name,url,headers}] }
  default_model  text not null default 'claude-sonnet-4-6',
  updated_at     timestamptz not null default now()
);

create table conversations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references profiles(id) on delete cascade,
  title                text not null default 'Nova conversa',
  model                text not null default 'claude-sonnet-4-6',
  system_prompt        text,
  compaction_count     int  not null default 0,
  total_input_tokens   bigint not null default 0,
  total_output_tokens  bigint not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);
create index conversations_user_idx on conversations(user_id, updated_at desc) where deleted_at is null;

create table messages (
  id                           uuid primary key default gen_random_uuid(),
  conversation_id              uuid not null references conversations(id) on delete cascade,
  role                         text not null check (role in ('user','assistant','system','tool')),
  content                      jsonb not null, -- array AI SDK content parts
  input_tokens                 int,
  output_tokens                int,
  model                        text,
  is_summary                   boolean not null default false,
  summarizes_until_message_id  uuid references messages(id),
  created_at                   timestamptz not null default now()
);
create index messages_conv_idx on messages(conversation_id, created_at);

create table attachments (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references messages(id) on delete cascade,
  user_id       uuid not null references profiles(id),
  storage_path  text not null,       -- bucket chat-attachments
  mime_type     text not null,
  size_bytes    bigint not null,
  original_name text,
  kind          text not null check (kind in ('image','pdf')),
  created_at    timestamptz not null default now()
);

create table tool_invocations (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references messages(id) on delete cascade,
  tool_name    text not null,
  tool_source  text not null check (tool_source in ('builtin','mcp')),
  args         jsonb not null,
  result       jsonb,
  error        text,
  duration_ms  int,
  created_at   timestamptz not null default now()
);

create table shares (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  token           text not null unique,
  created_by      uuid not null references profiles(id),
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index shares_active_token_idx on shares(token) where revoked_at is null;

create table usage_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  message_id      uuid references messages(id) on delete set null,
  model           text not null,
  input_tokens    int  not null default 0,
  output_tokens   int  not null default 0,
  cost_usd        numeric(12,6) not null default 0,
  event_kind      text not null check (event_kind in ('chat','compaction','tool_llm')),
  created_at      timestamptz not null default now()
);
create index usage_user_day_idx on usage_events(user_id, created_at);

create table audit_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references profiles(id) on delete set null,
  event_type     text not null,         -- 'conversation.created', etc.
  resource_type  text,
  resource_id    text,
  metadata       jsonb not null default '{}'::jsonb,
  ip_address     text,
  user_agent     text,
  created_at     timestamptz not null default now()
);
create index audit_created_idx  on audit_events(created_at desc);
create index audit_user_idx     on audit_events(user_id, created_at desc);
create index audit_type_idx     on audit_events(event_type, created_at desc);
```

### 3.1 RLS Policies (#EXPORT_CRITICAL)

Todas tabelas com `enable row level security`. Políticas resumidas:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | owner | service_role | owner | service_role |
| user_settings | owner | owner | owner | — |
| conversations | owner | owner | owner | owner (soft) |
| messages | via conv owner | owner | — | — |
| attachments | owner | owner | — | owner |
| tool_invocations | via conv owner | service_role | — | — |
| shares | owner | owner | owner | — |
| usage_events | owner | service_role | — | — |
| audit_events | service_role | service_role | — | — |

**Share público** NÃO usa RLS direto. Expõe via função:

```sql
create or replace function public.get_shared_conversation(p_token text)
returns jsonb
language plpgsql
security definer
as $$ ... $$;
```

Função retorna `{ conversation, messages, attachments }` apenas se `revoked_at IS NULL`. Anexos retornam com signed URLs geradas por RPC.

---

## 4. Fluxo de request (chat)

```
Client POST /api/chat
   │  { conversationId, text, attachmentIds[] }
   ▼
Middleware: valida sessão Supabase → user_id
   │
   ▼
Handler:
  1. caps.check(user_id, GLOBAL)  → se >, 429 "quota exceeded" + audit
  2. load history (conv messages where id > last_summary ∪ summary)
  3. load user_settings → enabled_tools, mcp_config
  4. build tools = [...builtins filtered, ...mcpTools()]
  5. aiSDK.streamText({ model, messages, tools, maxSteps: 5 })
  6. onFinish:
       - insert messages (user, assistant, tool msgs)
       - insert tool_invocations
       - insert usage_event (tokens, cost)
       - audit.log('message.received')
       - if ctx > 80% → enqueue compaction (fire-and-forget)
  7. stream SSE → client
```

---

## 5. ADRs (decisões arquiteturais)

### ADR-001 — Supabase sobre Neon+Auth.js+Blob
**Contexto:** 3 serviços versus 1 integrado.
**Decisão:** Supabase.
**Consequências:** +1 vendor lock-in, +3 dependências a menos, +Google OAuth em 2 cliques, +RLS nativo. **Aceito.**

### ADR-002 — Drizzle sobre Prisma
**Contexto:** precisamos de types + migrations rápidas.
**Decisão:** Drizzle.
**Consequências:** mais SQL explícito (bom), sem RLS helpers automágicos (compensado com queries typesafe + service role). **Aceito.**

### ADR-003 — PDF via vision nativo
**Contexto:** parse local (`pdf-parse`) × enviar bytes direto ao Claude.
**Decisão:** bytes direto.
**Consequências:** +custo em tokens, +fidelidade (diagramas/tabelas), -código. **Aceito** dado prazo.

### ADR-004 — Compaction por summary
**Contexto:** sliding window × summarização LLM.
**Decisão:** summarização.
**Consequências:** +1 LLM call quando acionado, mas preserva contexto decisivo. Resumo sai no mesmo modelo. **Aceito.**

### ADR-005 — MCP via config JSON
**Contexto:** UI de gerência de servers × JSON em settings.
**Decisão:** JSON.
**Consequências:** menos UX friendly, mas 1h de trabalho. Pontua diferencial sem explodir escopo. **Aceito.**

### ADR-006 — Share via Postgres function (SECURITY DEFINER)
**Contexto:** policies RLS por token são complexas.
**Decisão:** função stored com validação explícita.
**Consequências:** uma superfície controlada; expõe exatamente os campos safe. **Aceito.**

### ADR-007 — Audit log em Postgres (não em Supabase Logs)
**Contexto:** queríamos query sobre eventos de negócio.
**Decisão:** tabela `audit_events` em app DB.
**Consequências:** +volume de escritas, +flexibilidade de consulta e display na UI. **Aceito.**

---

## 6. Estratégia de env vars

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                         # Postgres connection string (pooler)
DIRECT_URL=                           # Postgres direct (migrations)

# Anthropic
ANTHROPIC_API_KEY=

# Tool providers
TAVILY_API_KEY=
# Jina Reader não precisa key

# Caps
USER_DAILY_TOKEN_CAP=100000
GLOBAL_DAILY_TOKEN_CAP=2000000

# App
NEXT_PUBLIC_APP_URL=https://chat-challenge.vercel.app
```

---

## 7. Pricing table (hardcoded em `lib/usage/pricing.ts`)

| Modelo | Input (USD/1M) | Output (USD/1M) |
|---|---|---|
| claude-sonnet-4-6 | 3.00 | 15.00 |
| claude-opus-4-7 | 15.00 | 75.00 |

(Atualizar com valores reais do portal Anthropic na implementação.)

---

## 8. Observabilidade mínima

- `console.log` estruturado (JSON) nas API routes
- Vercel Logs (built-in) suficiente pro escopo
- `audit_events` serve como "trail" de negócio
- Sem Sentry/Datadog no MVP

---

## 9. Segurança — checklist pré-deploy (#EXPORT_CRITICAL)

- [ ] RLS habilitada em todas as tabelas de domínio
- [ ] Service role key só no server (nunca em `NEXT_PUBLIC_*`)
- [ ] `get_shared_conversation()` com `security definer` + validação de `revoked_at`
- [ ] Signed URLs de anexos com TTL ≤ 1h
- [ ] CORS restrito à origem do app
- [ ] Rate limit informal via cap de tokens (suficiente pro MVP)
- [ ] Input validation (Zod) em todas as API routes
- [ ] CSRF: Next.js Server Actions já blindam

