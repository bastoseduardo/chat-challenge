# Tasks — Chat Challenge

**Deadline:** 2026-10-15 12h00 · **Hoje:** 2026-10-12
**Lista flat ordenada pelo caminho crítico. Marque com [x] ao completar.**

---

## 🟢 Dia 1 — Fundação (12/10) — ~8h

### Setup (1h)
- [ ] T001 Criar repo GitHub `chat-challenge`
- [ ] T002 `pnpm create next-app` (TS, Tailwind, App Router)
- [ ] T003 Instalar deps: `ai @ai-sdk/anthropic drizzle-orm pg @supabase/ssr @supabase/supabase-js zod nanoid`
- [ ] T004 Instalar devDeps: `drizzle-kit @types/pg tsx`
- [ ] T005 Setup shadcn/ui + componentes base
- [ ] T006 Criar projeto Supabase + copiar keys
- [ ] T007 `.env.local` com todas vars (ver arch §6)
- [ ] T008 Script `scripts/check-env.ts`

### Database (1.5h)
- [ ] T009 `drizzle.config.ts` apontando pro Supabase
- [ ] T010 Schema Drizzle completo (ver arch §3)
- [ ] T011 Migration inicial (`drizzle-kit generate`)
- [ ] T012 Aplicar: `drizzle-kit migrate`
- [ ] T013 SQL manual: RLS policies em todas tabelas
- [ ] T014 SQL manual: função `get_shared_conversation`
- [ ] T015 SQL manual: trigger auto-create profile on signup
- [ ] T016 Criar bucket `chat-attachments` (private)

### Auth (1h)
- [ ] T017 Supabase: habilitar Google provider
- [ ] T018 GCP: criar OAuth client, callback Supabase
- [ ] T019 `lib/supabase/{server,browser,middleware}.ts`
- [ ] T020 Middleware Next.js protegendo rotas
- [ ] T021 Página `/login` com Google button
- [ ] T022 Rota `/auth/callback`
- [ ] T023 Smoke test: login flow completo

### Chat core (3h)
- [ ] T024 `lib/db/queries/conversations.ts`
- [ ] T025 `lib/db/queries/messages.ts`
- [ ] T026 API `/api/conversations` (GET, POST)
- [ ] T027 API `/api/conversations/[id]` (GET, PATCH, DELETE soft)
- [ ] T028 `lib/ai/client.ts` com Claude Sonnet 4.6
- [ ] T029 API `/api/chat` com `streamText` básico (sem tools)
- [ ] T030 Layout `(app)/layout.tsx` com Sidebar
- [ ] T031 `<Sidebar/>` com lista de conversas
- [ ] T032 Página `/c/[id]` com `<ChatView/>`
- [ ] T033 `<Composer/>` (text only)
- [ ] T034 `<Message/>` com react-markdown + rehype-highlight
- [ ] T035 Hook `useChat` do AI SDK integrado
- [ ] T036 Auto title: API `/api/conversations/[id]/title` após 1ª resposta
- [ ] T037 Rename inline + delete menu

### Deploy inicial (1h) — valida OAuth em prod cedo
- [ ] T038 Push para GitHub
- [ ] T039 Vercel: import + env vars
- [ ] T040 Supabase: adicionar redirect URL de prod
- [ ] T041 GCP OAuth: adicionar callback de prod
- [ ] T042 Smoke test login no deploy

### Audit base (0.5h)
- [ ] T043 `lib/audit/log.ts` com `logAudit()`
- [ ] T044 Hooks em login/logout, conversation.{created,deleted}, message.sent

---

## 🟡 Dia 2 — Features core (13/10) — ~8h

### Attachments (3h)
- [ ] T045 Policy do bucket `chat-attachments` (owner read, no public)
- [ ] T046 API `/api/attachments/upload` → signed PUT URL
- [ ] T047 API `/api/attachments/[id]/url` → signed GET URL (TTL 1h)
- [ ] T048 `<AttachmentButton/>` + multi file picker
- [ ] T049 Validação client (tipo, tamanho, max 5)
- [ ] T050 Upload direto do browser pro signed URL
- [ ] T051 Insert row em `attachments` após upload
- [ ] T052 `<AttachmentPreview/>` tiles no composer
- [ ] T053 Composer envia `attachment_ids[]` pro `/api/chat`
- [ ] T054 `/api/chat` mapeia attachments pra content parts (image/file do AI SDK)
- [ ] T055 Renderização de anexos nas mensagens (thumb clicável)
- [ ] T056 Audit: `attachment.uploaded`
- [ ] T057 Smoke: imagem + PDF funcionam

### Tools built-in (2h)
- [ ] T058 `lib/ai/tools/web-search.ts` (Tavily)
- [ ] T059 `lib/ai/tools/web-scrape.ts` (Jina Reader)
- [ ] T060 `lib/ai/tools/get-current-time.ts`
- [ ] T061 `/api/chat` carrega `enabled_tools` do user
- [ ] T062 `streamText` recebe tools filtradas
- [ ] T063 Persistir `tool_invocations` no onFinish
- [ ] T064 `<ToolCallCard/>` renderiza na thread
- [ ] T065 Audit: `tool.invoked`
- [ ] T066 Página `/settings` com switches
- [ ] T067 API `/api/settings` GET/PATCH

### Compaction (2h)
- [ ] T068 `lib/ai/tokens.ts` com `estimateTokens`
- [ ] T069 `lib/ai/history.ts` com `buildContext` (summary + recent)
- [ ] T070 `/api/chat` usa `buildContext`
- [ ] T071 `lib/ai/compaction.ts` com `compactIfNeeded`
- [ ] T072 Prompt de summarization
- [ ] T073 Chamada após onFinish via `waitUntil`
- [ ] T074 Badge "comprimido Nx" no header do chat
- [ ] T075 Audit: `compaction.executed`
- [ ] T076 Usage event `event_kind='compaction'`
- [ ] T077 Teste: forçar `CTX_WINDOW=5000` em env e disparar

### Cap de tokens (1h)
- [ ] T078 `lib/usage/pricing.ts` com tabela
- [ ] T079 `lib/usage/counter.ts` com `recordUsage`
- [ ] T080 `lib/usage/caps.ts` com `assertWithinCaps`
- [ ] T081 Pre-check em `/api/chat` → 429 se exceder
- [ ] T082 Modal "quota exceeded" na UI
- [ ] T083 Página `/usage` + API `/api/usage/me`
- [ ] T084 Audit: `quota.exceeded`

---

## 🟠 Dia 3 — Share, MCP, polish, deploy (14/10) — ~8h

### Share (1.5h)
- [ ] T085 Migration shares + função `get_shared_conversation`
- [ ] T086 API `/api/conversations/[id]/share` POST/DELETE
- [ ] T087 `<ShareDialog/>` modal
- [ ] T088 Página `/share/[token]` SSR
- [ ] T089 API `/api/share/[token]/attachment/[id]`
- [ ] T090 OG meta tags
- [ ] T091 Audit: `conversation.{shared,unshared}`
- [ ] T092 Teste em aba anônima

### MCP (2h)
- [ ] T093 `lib/ai/mcp.ts` com `loadMcpTools`
- [ ] T094 Settings page: textarea JSON MCP + validação
- [ ] T095 Integrar MCP tools no `streamText`
- [ ] T096 Migration `user_notes`
- [ ] T097 MCP server `mcp-servers/user-notes/` (SSE)
- [ ] T098 Endpoint `/api/mcp/user-notes` servindo o server
- [ ] T099 Audit: `mcp.server.connected`
- [ ] T100 Smoke: chat invoca `save_note` e `list_notes`

### Audit UI (0.5h)
- [ ] T101 Column `profiles.is_admin` + marcar user de teste
- [ ] T102 Guard em `/admin/audit`
- [ ] T103 API `/api/admin/audit` paginada + filtros
- [ ] T104 Página com tabela

### Polish (1.5h)
- [ ] T105 Error boundaries em pages principais
- [ ] T106 Loading states (skeletons)
- [ ] T107 Empty states (sidebar vazia, conv nova)
- [ ] T108 Toast de erros
- [ ] T109 404 e 500 pages customizadas
- [ ] T110 Favicon + title tags
- [ ] T111 Responsivo básico (mobile view)

### Final deploy + verificação (1h)
- [ ] T112 Rodar `pnpm build` local, zero warnings
- [ ] T113 Testar golden path completo no deploy
- [ ] T114 Rodar smoke multi-user (2 contas Google)
- [ ] T115 Verificar RLS: user A não vê conv de user B
- [ ] T116 Verificar share revogado retorna 404

### Entrega (1.5h)
- [ ] T117 Gravar vídeo 3-4 min (golden path)
- [ ] T118 Upload YouTube unlisted
- [ ] T119 Escrever README.md executivo
- [ ] T120 Enviar email de entrega

---

## 🔵 Buffer (15/10 manhã) — ~4h
Se sobrar tempo antes das 12h00:

- [ ] Google Drive connector (OAuth scope + tool `drive_read_file`)
- [ ] Gmail connector (tool `email_search`)
- [ ] Admin UI pra editar caps
- [ ] Testes unitários críticos
- [ ] Melhorias de UX

---

## Dependências ocultas (alertas)

- **T006 → T038**: deploy inicial só funciona depois do Supabase pronto.
- **T017/T018 → T042**: OAuth em prod depende das URLs de callback de prod.
- **T051 → T054**: content parts precisam dos attachment IDs no DB.
- **T069 → T070**: `buildContext` precisa existir antes do `/api/chat` final.
- **T093 → T095**: MCP client factory antes de integrar no stream.

---

## Métricas pessoais

- Tempo total alocado: ~24h (3 dias × 8h)
- Tempo "estimado necessário": ~22h
- Buffer: 2h + manhã Dia 4
