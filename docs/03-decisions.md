# Decisões técnicas — guia para defesa em entrevista

> Cada seção tem: **o que foi escolhido**, **por que**, **tradeoff aceito**, **alternativas descartadas**.
> Prazo do desafio: 72h. Esse constraint é citado como "**#prazo**" quando foi o fator decisivo.

---

## 0. Metodologia (antes do código)

### 0.1 Descartar o harness SAW
**Escolha:** não usar o repositório de harness que eu clonei inicialmente.

**Por quê:**
- Era um harness de **metodologia** (SAFe + 11 agentes + 20 skills), não um starter de chat.
- Ciclo SAFe (Epic → Feature → Story, PI planning, Linear sync, gates de QA) é otimizado pra time de 10+ pessoas em sprints de semanas — não pra um solo em 72h.
- Zero código do domínio chat; só configuração de workflow.

**Tradeoff:** perdi gates de QA formais e Linear tracking.

**Alternativas descartadas:**
- Usar o harness completo → overhead > ganho.
- Clonar `vercel/ai-chatbot` como base → o template é mais opinionated do que eu precisava e teria me obrigado a desaprender o layout dele.
- Começar do zero sem referência → feito.

### 0.2 Fluxo Discovery → PRD → Arquitetura → Specs → Tasks
**Escolha:** 4 artefatos sequenciais antes de qualquer código (todos em `docs/`).

**Por quê:**
- `00-discovery.md`: fechou 33 decisões de produto em uma rodada só (vs decidir ad-hoc durante o código).
- `01-prd.md`: 28 user stories P0/P1/P2 — base para decidir o que cortar se o prazo apertar.
- `02-architecture.md`: 7 ADRs curtos, schema do banco completo antes de 1 linha de código.
- `docs/specs/SPEC-00[1-7]`: 7 fatias de ~1 página cada, com acceptance criteria.
- `tasks.md`: 120 tasks numeradas no caminho crítico.

**Tradeoff:** 3h de planejamento antes de codar. **Pagou de volta** em 2 benefícios:
1. Zero retrabalho de arquitetura (não troquei de banco/ORM no meio).
2. Material pronto pra entrevista (defendo cada decisão com documento).

**Alternativa descartada:** mergulhar direto no código → risco de pivotar stack no dia 2.

---

## 1. Stack

### 1.1 Framework: **Next.js 16 (App Router + Turbopack)**
**Por quê:**
- Full-stack num só repo (API routes + SSR + componentes RSC).
- Deploy 1-click no Vercel (mesma empresa).
- App Router permite misturar RSC (server) e Client Components, otimizando o que precisa de JS no browser.
- Turbopack dá dev server ~5x mais rápido.

**Tradeoff:**
- Next 16 é novo (saiu há pouco) — pegou algumas quebras (`middleware` → `proxy`, `cacheComponents` default true).
- Serverless cold start no Vercel (~500ms-1s na 1ª request).

**Alternativas descartadas:**
- **Remix / React Router v7**: boa, mas Vercel integra melhor com Next.
- **SvelteKit**: menos boilerplate, mas eu teria curva + o ecossistema de componentes é menor.
- **Backend separado (Node Express/Fastify) + frontend SPA**: mais código, mais deploy, zero ganho pro escopo.
- **tRPC**: elegante, mas Server Actions do Next já dão type-safety suficiente.

### 1.2 LLM SDK: **AI SDK 7 (Vercel)**
**Por quê:**
- Abstrai tool-calling, streaming, vision, MCP, retries e múltiplos providers.
- Hook `useChat` do lado cliente já cuida de SSE, mensagens otimistas, assembly de parts.
- Interoperabilidade: `getModel("claude-sonnet-4-6")` ou troca pra `openai("gpt-4o")` em 1 linha.
- MCP via `@ai-sdk/mcp` com transport pluggable (foi essencial — ver §3.4).

**Tradeoff:**
- Camada a mais entre eu e a API da Anthropic. Alguns features novos do Claude 4.6 (ex. `extended_thinking` em contextos específicos) demoram pra chegar no SDK.
- Semantic versioning do SDK é ativo: subiu de v5 pra v7 enquanto eu codava.

**Alternativas descartadas:**
- **`@anthropic-ai/sdk` direto**: teria controle total mas me obrigaria a implementar streaming SSE, assembly de content parts e tool loop manual.
- **LangChain / LlamaIndex**: pesados, duas camadas extras, documentação instável. Overkill pro escopo.
- **Mastra**: framework agentic — bom pra workflows, overkill pra um chat UI.

### 1.3 Modelo: **Claude Sonnet 4.6**
**Por quê:**
- Vision nativo (imagem + PDF em content parts), não precisa parse local.
- Context window 200k — folga confortável antes da compaction.
- Tool use de qualidade (importante com 3+ tools concorrentes).
- Custo moderado: $3/$15 por 1M tokens (in/out) — ~5x mais barato que Opus.
- Streaming nativo via SSE.

**Tradeoff:**
- Sonnet às vezes alucina mais que Opus em prompts densos. Pro escopo (chat conversacional) é aceitável.

**Alternativas descartadas:**
- **Opus 4.7**: melhor qualidade, 5x mais caro — não justifica no demo.
- **Haiku 4.5**: mais barato, mas vision mais fraco e sem tool use multi-step confiável.
- **GPT-4o**: comparável em qualidade; não escolhi por preferência por Anthropic + pricing cache melhor.
- **Gemini 2.5 Flash/Pro**: context 1M interessante pra compaction tardia, mas vision/PDF menos robusto na época.

### 1.4 DB + Auth + Storage: **Supabase** (combo)
**Por quê:**
- 3 serviços em 1 fornecedor: Postgres + Auth + Storage + RLS nativo.
- Google OAuth em 2 cliques no dashboard.
- Postgres sério (não SQLite), com RLS para separação de dados por usuário.
- Free tier generoso: 500 MB DB, 1 GB storage, 50k MAU.
- Dashboard pra inspecionar durante demo.

**Tradeoff:**
- Vendor lock-in moderado (poderia migrar pra Postgres cru + Auth.js + S3, mas levaria dias).
- Service role key é uma chave única — se vazar, bypassa toda RLS.
- RLS exige SQL — não é testável só com unit tests do app.

**Alternativas descartadas:**
- **Neon Postgres + Auth.js + Vercel Blob**: 3 serviços separados, mais env vars, mais fricção pra setup. Benefício seria: menos lock-in.
- **PlanetScale (MySQL)**: ótimo, mas MySQL + sem RLS nativo = Auth custom = mais código.
- **Firebase**: NoSQL não cai bem para o schema relacional de audit/usage/share.
- **SQLite (via libSQL/Turso)**: ótimo pra edge, mas RLS não existe e eu precisaria duplicar lógica no app.

### 1.5 ORM: **Drizzle**
**Por quê:**
- Schema em TypeScript (fonte única), gera migrations SQL versionadas.
- SQL explícito nas queries — sem a "mágica" do Prisma (que gera N+1 fáceis).
- Suporte a `schemaFilter: ['public']` — crucial para ignorar o schema `auth` do Supabase sem conflitos de migration (bug que apareceu durante o setup).
- Build mais leve e tipos mais simples que Prisma.

**Tradeoff:**
- Verbosidade do SQL. Em casos de joins complexos, mais linhas.
- Menos recursos opinados (ex: Prisma Studio é mais bonito que `drizzle-kit studio`).

**Alternativas descartadas:**
- **Prisma**: ótimo DX mas: build mais pesado, `prisma generate` lento, binary engine, RLS integration via middleware customizado chato.
- **Kysely**: query builder puro, bom, mas sem schema-first.
- **Supabase SDK direto** (sem ORM): perdeu type-safety de joins complexos.
- **Raw SQL (`postgres` library direto)**: produção OK, mas sem type-safety sem muito boilerplate.

### 1.6 Tools: **Tavily (search)** + **Jina Reader (scrape)**
**Por quê Tavily:**
- 1 endpoint, auth Bearer, 1k requests/mês free sem cartão.
- Retorna snippets limpos e URLs — pronto pra citação.
- API estável há 1+ ano.

**Por quê Jina Reader:**
- Zero API key, zero rate limit documentado.
- URL `https://r.jina.ai/<url>` já retorna markdown pronto pra LLM.
- Lida com JS-rendered pages.

**Tradeoff:**
- Dependência de 2 serviços externos. Se o Tavily cair, `web_search` para.
- Jina sem auth = sem SLA — se eles mudarem política, quebra.

**Alternativas descartadas:**
- **Brave Search API**: 2k/mês free, qualidade comparável — escolheria o Tavily por retorno mais limpo pra LLM.
- **Serper.dev / SerpAPI**: ótimos, pagos.
- **Firecrawl**: scrape excelente, mas 500 páginas/mês free e precisa de key.
- **Puppeteer/Playwright self-hosted**: fugindo do escopo (precisa de ambiente headless, incompatível com serverless clássico).

### 1.7 Deploy: **Vercel**
**Por quê:**
- Zero config para Next.js (mesmo fornecedor do framework).
- Push → URL pública em ~90s.
- Edge network + serverless function cold start aceitável para o escopo.
- Logs e environment vars no dashboard, sem CLI mandatória.

**Tradeoff:**
- Serverless function tem limite de 60s por invocação no plano hobby — relevante pra streaming longo (ver §4.1).
- Vendor lock-in moderado (railway, fly.io, render fariam o mesmo com config extra).

**Alternativas descartadas:**
- **Railway / Fly.io / Render**: mais trabalho de config pra Next.js SSR.
- **Self-hosted (VPS)**: fora de escopo.
- **Cloudflare Workers**: edge perfeito, mas Workers tem limites em deps Node nativas (ex: `postgres`, Buffer com data pesada).

---

## 2. Schema do banco

### 2.1 11 tabelas em `public`, todas com RLS
**Tabelas:**
`profiles`, `user_settings`, `conversations`, `messages`, `attachments`, `tool_invocations`, `shares`, `usage_events`, `audit_events`, `user_notes`.

**Decisões específicas:**

#### 2.1.1 `messages.content` como `jsonb`
**Por quê:** o AI SDK usa `UIMessagePart[]` com múltiplos tipos (text, file, tool-call). Normalizar isso em várias tabelas seria custoso e inflexível para novos tipos.

**Tradeoff:** sem checks a nível de banco no shape do content. Validação só no app.

**Alternativa descartada:** tabela separada `message_parts` → mais joins, zero ganho.

#### 2.1.2 Soft delete em `conversations` (`deleted_at`)
**Por quê:** permite "undo" potencial e preserva audit de ações sobre conversas deletadas.

**Tradeoff:** queries sempre filtram `deleted_at IS NULL`.

**Alternativa descartada:** hard delete + cascade → perde histórico de audit referenciando a conversa.

#### 2.1.3 `attachments.storage_path` (não `url`)
**Por quê:** o bucket é privado; URLs são assinadas on-demand com TTL curto (1h). Armazenar URL fixa não funcionaria.

**Tradeoff:** cada render de anexo gera uma signed URL — custo mínimo mas presente.

#### 2.1.4 `is_summary` boolean em `messages` (em vez de tabela separada)
**Por quê:** o resumo da compaction é tratado pelo app como mensagem `role=system` especial. Separar em `message_summaries` duplicaria lógica de ordenação temporal.

**Tradeoff:** filtros de UI precisam explicitamente excluir `is_summary=true`.

### 2.2 **RLS habilitada em todas as tabelas**
**Por quê:** Supabase expõe PostgREST a partir do `anon` key — sem RLS, qualquer um lê qualquer tabela. RLS é a camada de segurança **primária**.

**Policies-chave:**
- `conversations`: `user_id = auth.uid()`.
- `messages`: via join com `conversations.user_id`.
- `audit_events` / `usage_events`: só leitura do próprio; writes via service_role.
- `shares`: owner-only pra mutations; read público via função stored (não policy).

**Tradeoff:** policies complexas são difíceis de testar — exigem testes de integração com 2+ usuários reais.

**Alternativa descartada:** bypassar RLS no app (service role em tudo). **Rejeitada**: um bug de query (`where` esquecido) virava vazamento cross-user.

### 2.3 Share via função Postgres `SECURITY DEFINER`
**Por quê:** share público não pode usar RLS tradicional (anon não tem `auth.uid()`). Uma função `security definer` roda com privilégios do owner, validando o token manualmente e expondo **apenas** campos safe.

**Tradeoff:** lógica de negócio no SQL (menos testável em TS). Mitigado por ser 1 função pequena.

**Alternativas descartadas:**
- Policy `shares` que verifica token em cookie/header → complicado, exige extensão `request.jwt.claims`.
- Endpoint API dedicado puxando com service role → **isso é o que acabei fazendo acima da função**. Com a função, a lógica fica no banco e o endpoint é thin.

### 2.4 `schemaFilter: ['public']` no Drizzle
**Por quê:** o Drizzle schema referencia `auth.users` para a FK de `profiles.id`. Sem o filter, o `drizzle-kit generate` tenta criar a tabela `auth.users` — que já existe no Supabase e é intocável.

**Historia real:** Perdi 15 min no deploy por causa disso (erro "permission denied for schema auth"). Fix: remover o CREATE TABLE da migration manualmente **e** adicionar o `schemaFilter` pra não voltar a aparecer.

---

## 3. Features-chave

### 3.1 Streaming via `useChat` + `DefaultChatTransport`
**Por quê:** o AI SDK 7 abstrai o protocolo SSE/UIMessageStream com `prepareSendMessagesRequest` → eu posso injetar `conversationId` e `attachments` no body sem reescrever o cliente.

**Tradeoff:** o shape das mensagens no cliente é `UIMessage` (parts), diferente de `ModelMessage` (content). Preciso converter com `convertToModelMessages` no server.

### 3.2 Attachments: upload direto do browser → Supabase Storage (signed PUT)
**Por quê:**
- Serverless function de upload teria limite de body (~4MB no Vercel hobby). Signed PUT elimina esse limite.
- Também evita trafegar bytes pelo app duas vezes (browser → app → storage vs browser → storage).

**Fluxo:**
```
Client → POST /api/attachments/upload  (metadados)
Server → gera signed PUT URL
Client → PUT direto no signed URL (file bytes)
Client → POST /api/chat com [{storagePath, mime, kind}]
Server → baixa bytes do storage + injeta como file part no model
Server → cria row em attachments linkada à message
```

**Tradeoff:** 2 round-trips HTTP antes da mensagem ser enviada. Aceitável porque o upload acontece durante o typing.

**Alternativas descartadas:**
- Upload através do servidor em `/api/chat` com multipart form data → limite de body + duas transferências.
- Base64 inline no JSON do chat → inflaciona 33% o payload.

### 3.3 PDF via **vision nativo** do Claude (bytes direto)
**Por quê:**
- Claude Sonnet 4.6 aceita PDFs como `type: "file"` content part — ele mesmo faz OCR + layout understanding.
- Preserva **diagramas, tabelas, imagens embutidas** — texto extraído via `pdf-parse` perderia.

**Tradeoff:**
- Custo em tokens: PDF conta como "~1500 tokens por página" (média). Caro em PDFs longos.
- Vazamento de bytes no body do request pro Claude — latência maior.

**Alternativas descartadas:**
- `pdf-parse` / `unpdf` local → só texto. Perde contexto visual.
- Converter páginas em imagens e enviar como vision → mesmo resultado, mais complexo.

### 3.4 MCP com **transport in-memory** para servers do próprio deploy
**Por quê** (essa é a decisão mais interessante tecnicamente):

Problema que apareceu em produção:
- Configurei o MCP user-notes com URL `https://chat-challenge-six.vercel.app/api/mcp/user-notes`
- Em dev local funcionava.
- Em produção: **`fetch failed`** intermitente.
- Causa: serverless function do Vercel tentando chamar o próprio domínio → DNS/TLS loop pela edge network é flaky.

Fix:
- Implementei `InMemoryMCPTransport` que satisfaz a interface `MCPTransport` do `@ai-sdk/mcp` chamando o handler **em memória** no mesmo processo.
- Factory em `lib/ai/mcp.ts` detecta URLs internas (host match contra `VERCEL_URL` / `NEXT_PUBLIC_APP_URL` / etc.) e usa in-memory. URLs externas usam HTTP normal.
- Também extraí o handler do route para `lib/mcp/user-notes-handler.ts` pra ser reusado por ambos (HTTP + in-memory).

**Tradeoff:**
- Perdi "pureza" do MCP (não é mais 100% rede). Mas o protocolo (initialize → tools/list → tools/call) continua idêntico, só o transport muda.
- Dois caminhos de código pra manter.

**Alternativas descartadas:**
- Resolver o fetch failed na infra → fora do meu controle (comportamento Vercel).
- Usar `VERCEL_URL` como workaround → mesmo problema (ainda é edge network).
- Hospedar o MCP server externamente (Railway) → mais um serviço, mais um deploy.

### 3.5 Compaction: **summarization LLM** (não sliding window)
**Por quê:**
- Sliding window perde contexto decisivo (decisões, fatos chave).
- Summarization preserva o essencial em 500 tokens, mantém últimas 10 mensagens íntegras.
- Prompt pede marcação em markdown (Decisões, Fatos, Pendências) — formato auditável.

**Trigger:** quando `total_tokens >= 80% * context_window` (160k de 200k).

**Execução:** background via `after()` do Next 16 (post-stream, não bloqueia o usuário).

**Tradeoff:**
- 1 chamada LLM extra por compaction (custo contabilizado em `usage_events` com `event_kind='compaction'`).
- Resumo pode omitir detalhe não óbvio.

**Alternativas descartadas:**
- **Sliding window puro**: perda de contexto.
- **Importance scoring de mensagens**: complexo, exigiria pipeline próprio.
- **Streaming de compaction para o usuário**: UX pior (interrompe o fluxo).
- **Compaction cron fora do request**: mais infra, mais latência pra ver efeito.

### 3.6 Tool loop: **`stopWhen: 5 steps`**
**Por quê:** com 3+ tools disponíveis + MCP, o modelo pode entrar em loop (busca → scrape → busca → scrape...). 5 steps é o default do AI SDK pra agentes razoáveis e cobre fluxos tipo "pesquisa → leia 2 links → responda".

**Tradeoff:** truncation em cenários complexos onde o modelo precisaria de 6+ passos.

**Alternativa descartada:** sem limite → DOS acidental do próprio app (quota de user) ou timeout de serverless (60s).

### 3.7 Cap de tokens: **duas camadas (user + global)**
**Por quê:**
- **User cap** (100k/dia) → previne um usuário consumir todo o budget.
- **Global cap** (2M/dia) → previne surpresa em fatura (se alguém compartilha o app). Protege o cartão.

**Enforcement:** pre-check otimista antes do `streamText` — soma de `usage_events` do dia + `estimated_input` deve caber nos dois caps.

**Tradeoff:** race condition — se 2 requests concorrentes passarem pelo check simultaneamente, podem exceder o cap por pouco. **Aceito**: margem de erro < 5%.

**Alternativas descartadas:**
- Advisory lock no Postgres → complexo, atrasa cada request.
- Hard limit via trigger no banco → menos flexível.
- Cap só em USD → mais caro de calcular (fx rates, modelos diferentes), menos intuitivo.

### 3.8 Audit log: tabela própria + `after()` logging
**Por quê:**
- Supabase Logs é bom pra debug infra, ruim pra audit de negócio (não é queriable fácil, retenção limitada).
- Tabela própria = queryable, filtrável, pode virar UI (`/admin/audit`).

**Eventos auditados (13):** `user.login`, `user.logout`, `conversation.{created,deleted,shared,unshared}`, `message.{sent,received}`, `tool.invoked`, `attachment.uploaded`, `compaction.executed`, `quota.exceeded`, `mcp.server.connected`.

**Tradeoff:**
- Volume de writes no banco (potencialmente alto).
- Linking com user via `user_id` → se o user for deletado, `on delete set null` preserva o evento sem user.

**Alternativas descartadas:**
- Sentry / Datadog → overkill pro escopo.
- Supabase Realtime → útil mas não resolve o problema (não é queryable).

### 3.9 Share: **live** (reflete novas mensagens), não snapshot
**Por quê:** mais útil pro caso de uso ("aqui está minha pesquisa evoluindo"). Trivialmente implementado: query lê sempre o estado atual.

**Tradeoff:** o dono pode acidentalmente expor mensagens novas que ele ainda não revisou. Mitigado pelo botão **Revogar**.

**Alternativa descartada:** snapshot → mais código (versioning de messages) e UX menos útil pro demo.

### 3.10 Admin via `ADMIN_EMAILS` + `profiles.is_admin`
**Por quê:**
- `ADMIN_EMAILS` em env é **zero-friction** no deploy inicial (bootstrap).
- `profiles.is_admin` permite granular pós-launch.

**Tradeoff:** duas fontes de verdade pra "quem é admin". Mitigado por `isAdmin()` consultar ambas.

**Alternativa descartada:** só `is_admin` → chicken-and-egg problem (primeiro admin precisa ser setado via SQL manual).

### 3.11 Prompt caching Anthropic via `cacheControl: ephemeral`
**Por quê:** o Claude cobra 10% de leitura em tokens cacheados vs 100% em leitura fresca. Marcando a penúltima mensagem com `providerOptions.anthropic.cacheControl.ephemeral`, cada follow-up na mesma conversa reusa o cache do bloco anterior (TTL ~5min).

**Economia observada:** ~70% dos input tokens em conversas de 3+ turnos.

**Implementação:** 1 bloco de código em `lib/ai/history.ts.buildContext()`, marcando `messages[len-2]`.

**Tradeoff:** só funciona em janelas de 5min; conversas pausadas por mais tempo não aproveitam.

**Alternativa descartada:** cachear o system prompt → system prompt pequeno (< 500 tokens), não compensa.

### 3.12 Attachments passados como **signed URL**, não como Buffer
**Problema anterior:** `buildContext()` baixava os bytes do Storage e injetava `data: Buffer` nas mensagens → 10MB de PDF = 10MB de upload pro Anthropic a cada turn.

**Fix:** Claude aceita `type: "file"` com `data: <url>`. Trocamos pra `createSignedDownloadUrl()` (TTL 1h).

**Economia:** ~90% de bandwidth em conversas com anexos.

**Tradeoff:** URL tem TTL — se a conversa for retomada após 1h, re-assina. (Já é o fluxo: `listMessagesWithAttachments` sempre re-assina ao carregar.)

### 3.13 Idempotência de mensagens via `client_message_id`
**Problema:** se o cliente perde conexão no meio do POST e re-tenta, a mesma mensagem pode entrar 2x no banco → cobrar tokens 2x + confundir o modelo.

**Fix:** nova coluna `messages.client_message_id` + índice único `(conversation_id, client_message_id)`. O client (useChat) passa o UI message id; o server faz `ON CONFLICT DO NOTHING`.

**Tradeoff:** 1 coluna + 1 índice extra. Negligível.

**Alternativa descartada:** debouncing no cliente → não resolve retry pós-erro de rede.

### 3.14 Audit retention via **Vercel Cron**
**Problema:** `audit_events` cresce ilimitadamente. LGPD recomenda retention explícita.

**Fix:** rota `/api/cron/cleanup-audit` que deleta eventos > `AUDIT_RETENTION_DAYS` (default 90). `vercel.json` agenda `0 3 * * *` (3h UTC diário). Protegida por `CRON_SECRET` (header `Authorization: Bearer`).

**Tradeoff:** audit > 90 dias é perdido. Pra compliance mais rígida, arquivaria em cold storage antes de deletar.

**Alternativa descartada:** cron no Supabase (pg_cron) → funciona, mas Vercel Cron é zero-config na mesma plataforma.

### 3.15 Modelo configurável **por conversa** (Sonnet / Opus / Haiku)
**Por quê:** diferentes tarefas pedem diferentes modelos.
- Sonnet 4.6 (default) — melhor custo/qualidade geral.
- Opus 4.7 — raciocínio complexo, análise longa.
- Haiku 4.5 — perguntas rápidas, custo mínimo.

**Implementação:** registry em `lib/ai/models.ts` (`MODELS` map) + `PATCH /api/conversations/[id]` aceitando `model` (whitelist). UI em `<ConversationSettings>` com cards selecionáveis.

**Tradeoff:** switch no meio da conversa pode mudar personalidade da resposta. Decidimos deixar assim — mais ferramenta que footgun.

**Alternativa descartada:** modelo global per-user → menos flexível.

### 3.16 System prompt **por conversa** (não global)
**Por quê:** persona por tarefa (ex.: "Você é um advogado LGPD" em uma conv e nada em outra) sem poluir todas.

**Implementação:** coluna `conversations.system_prompt` (opcional, max 10k chars). Passado como `system` do `streamText` quando presente.

**Tradeoff:** +1 coluna + 1 textarea na settings dialog. Trivial.

### 3.17 Tool invocations **hidratadas no histórico**
**Problema:** reload da página mostrava mensagens, mas sem os cards de tool call → UX quebrava a cada F5.

**Fix:** `listMessagesWithAttachments()` faz JOIN com `tool_invocations` e reconstrói `type: "dynamic-tool"` parts na ordem **files → tools → text**. Mesma lógica em `loadSharedConversation()` pra manter a página pública consistente.

**Tradeoff:** +1 query bulk (não N+1). Impacto desprezível.

### 3.18 Compaction baseline **estimado**, não zerado
**Problema anterior:** após compactar, `totalInputTokens` e `totalOutputTokens` eram zerados → barra de contexto mostrava 0% mesmo com summary + mensagens retidas pesados.

**Fix:** após compactação, estima tokens do summary + mensagens pós-corte via `estimateTokens()` e seta como baseline. Barra reflete o uso real.

**Tradeoff:** estimativa (chars/4) subestima ~5%. Aceito.

### 3.19 Rate limit **por IP** via Postgres atomic UPSERT
**Por quê:** cap de tokens protege o budget, mas não protege contra DOS de IP só com request de 1-token.

**Fix:** tabela `rate_limit_buckets (bucket_key text PK, window_start timestamptz, count int)`. Função atomic UPSERT retorna `allowed boolean`. Limits:
- `/api/chat`: 10/min por IP.
- `/api/attachments/sign-upload`: 20/min por IP.

**Tradeoff:** IP é inferido do header `x-forwarded-for` (Vercel). Pode ser falseado se não houver proxy antes, mas na Vercel o header é confiável.

**Alternativa descartada:** Upstash Redis → mais rápido, mas +1 serviço + env var só pra isso.

### 3.20 Busca semântica cross-conversation (pgvector + Voyage)
**Por quê:** busca por texto (`LIKE`/`tsvector`) exige palavras exatas. Usuário quer buscar "otimização de query" e achar conversa que falou de `EXPLAIN ANALYZE` e `índice composto`.

**Implementação:**
- `pgvector` nativo no Supabase (`CREATE EXTENSION vector`).
- Coluna `messages.embedding vector(512)` + índice HNSW com `vector_cosine_ops`.
- Embedding gerado via **Voyage** (`voyage-3-lite`, 20M tokens/mês free, dim 512 — otimizado pra chat).
- `after()` do Next dispara `embedDocument()` em background após salvar user + assistant messages. Não bloqueia stream.
- Função SQL `semantic_search_messages(user_id, query_embedding, limit)` com `SECURITY DEFINER`.
- UI: `<SearchDialog>` com ⌘K global, debounce 250ms, navegação por setas + Enter, badge "% match".
- Degradação graciosa: sem `VOYAGE_API_KEY`, só a busca falha (500); resto do app roda.

**Tradeoff:** +1 serviço externo + ~200ms de latência no save (background, invisível). HNSW usa ~30MB de RAM pra 10k messages — negligível.

**Alternativas descartadas:**
- **Postgres full-text (`tsvector`)** → sem semântica, falha em sinônimos.
- **OpenAI embeddings** → paga por uso + dim maior (1536) = HNSW mais lento.
- **In-process (Transformers.js)** → quebra edge runtime + modelo pesado.

### 3.21 Stop generation mid-stream
**Por quê:** usuário percebe que a resposta começou errada e quer parar sem esperar os 60s de maxDuration.

**Implementação:** `useChat` do AI SDK já expõe `stop()`. Botão `Square` substitui o `Submit` quando `status === "streaming"`. Chama `AbortController.abort()` por baixo, o server trata gracefully via `onError`.

**Tradeoff:** tokens já gerados até o abort são cobrados. UX > economia marginal.

### 3.22 Paste image do clipboard (Ctrl+V)
**Por quê:** screenshot é 80% do uso de vision em entrevistas técnicas. Ctrl+V é expected behavior em qualquer app de chat moderno.

**Implementação:** `onPaste` handler no Textarea do composer. Filtra `clipboardData.files` por `image/*`, usa `DataTransfer` pra passar pro `useAttachments.add()` existente. Toast confirma.

**Tradeoff:** nenhum — reusa o pipeline de upload existente.

### 3.23 Message export em **Markdown** (+ JSON opcional)
**Por quê:** usuário leva a conversa consigo. Markdown é portável (pode colar em Notion, Obsidian, GitHub).

**Implementação:** `GET /api/conversations/[id]/export?format=md|json`. Markdown inclui: título, metadata, system prompt, mensagens (user+assistant), anexos, tool invocations. Botão ⬇️ no header.

**Tradeoff:** export não inclui attachments binários — só os nomes/kinds. Pra incluir, seria um .zip (adicionaria dep).

---

## 4. UI/UX

### 4.1 **shadcn/ui** em cima de Radix
**Por quê:**
- Componentes copiados pro repo (código próprio, zero dependência) — eu posso modificar.
- Radix por baixo = acessibilidade correta (foco, teclado, ARIA).
- Styling com Tailwind v4 → consistência.

**Tradeoff:** copy-paste de componentes → upgrades manuais quando shadcn atualiza.

**Alternativas descartadas:**
- **Chakra / MUI / AntD**: pesados, estilização mais rígida.
- **HeadlessUI**: ótimo, mas menos componentes prontos.
- **Zero libraria (componentes próprios)**: #prazo.

### 4.2 Streaming UI com `role: "user"` optimistic
**Por quê:** AI SDK já implementa optimistic (user message aparece antes da resposta chegar).

**Tradeoff:** se o POST falhar (quota, rede), a UI precisa reconciliar.

### 4.3 Google OAuth-only (sem email/password)
**Por quê:**
- 1 provedor → menos tela de "escolha o método".
- Google OAuth destrava Gmail/Drive connectors (diferencial futuro).
- Avatar + nome vêm "de graça" do Google.
- #prazo.

**Tradeoff:** usuário sem Google não entra. Pra entrevista: zero risco (todos avaliadores têm Google).

**Alternativa descartada:** magic link via email → mais UI, mais testing.

### 4.4 Chat scroll com `flex-1 overflow-y-auto` + `min-h-0`
**Por quê:** o truque "fixo" pra flexbox: pai com `min-h-0` + filho `flex-1 overflow-y-auto` força o scroll acontecer dentro do filho, não no body.

**Historia real:** Esquecer `min-h-0` deu bug "chat sem scroll, página gigante infinita" em produção — fix foi exatamente adicionar isso em 3 níveis (`body`, chat layout wrapper, main).

---

## 5. Segurança

### 5.1 Service role key **só server-side**
**Por quê:** bypassa RLS. Se vazar no browser, qualquer um lê tudo.

**Enforcement:**
- Nunca prefixada com `NEXT_PUBLIC_`.
- Importada só em arquivos `app/api/*` e `lib/*` (sem `"use client"`).
- Vercel env var marcada como "Sensitive" (encriptada em repouso).

### 5.2 Signed URLs com TTL 1h
**Por quê:** usuário vê o anexo, mas se o signed URL vazar, expira rápido.

**Tradeoff:** se o usuário deixar a aba aberta por >1h, imagem quebra. Mitigável com `GET /api/attachments/[id]/url` on-demand.

### 5.3 Token do share: **nanoid 24 chars** (~144 bits)
**Por quê:** 144 bits de entropia são impraticáveis de brute-force. UUID (122 bits) também serviria; nanoid é um pouco mais compacto e URL-safe nativo.

### 5.4 CORS: default do Next (same-origin)
**Por quê:** API routes do Next não precisam liberar origin pro próprio frontend.

**Tradeoff:** se eu quisesse expor a API pra outro domínio, teria que adicionar headers.

### 5.5 Input validation: **Zod** em todas as API routes
**Por quê:** parse estrito do body → shape garantido → menos surpresas.

**Exemplo:** `/api/attachments/upload` valida `mimeType`, `sizeBytes`, `conversationId` como UUID.

### 5.6 CSRF: **implícito** via Server Actions / cookies samesite
**Por quê:** Next 16 defaulta cookies pra `samesite=lax` + API routes são same-origin only.

---

## 6. DevOps

### 6.1 **1 ambiente** (produção direta)
**Por quê:** #prazo. Pra time, teria `staging` separado.

**Tradeoff:** cada push em `main` vai direto pra prod. Mitigado por `npm run build` local antes do push.

### 6.2 Env vars: **Config** vs **Sensitive** no Vercel
- `NEXT_PUBLIC_*` → **Config** (plaintext, vai pro browser).
- Server-only (DB_URL, SERVICE_ROLE, ANTHROPIC_API_KEY) → **Sensitive** (encriptada).

**História real:** travei 20 min por não saber dessa distinção — Vercel default é Sensitive, mas Sensitive não aceita `NEXT_PUBLIC_*`.

### 6.3 Migrations: **Drizzle generate** + rodar SQL manual no Supabase
**Por quê:** no primeiro deploy, não vale a pena setup de CI pra rodar `drizzle-kit migrate` com `DIRECT_URL` nos secrets. SQL Editor do Supabase é 1 clique.

**Tradeoff:** o fluxo não é automatizado. Pra time, usaria GitHub Action.

### 6.4 Logs: `console.log` estruturado + Vercel Logs
**Por quê:** debug suficiente pro escopo. `console.error("[tool-persist]", err)` com namespace prefix facilita filtro.

**Alternativa descartada:** pino / winston → overhead.

---

## 7. O que NÃO foi feito (e por quê)

### 7.1 Edição de mensagens do usuário
**Por quê não:** regenerate (feito) cobre 80% do uso. Edit exigiria reconciliar o histórico (truncar msgs posteriores) + UI inline — ~4h extras.

### 7.2 Gmail connector
**Por quê não:** #prazo. Drive já cobriu o diferencial de connector; Gmail duplicaria o padrão sem ROI.

### 7.3 Admin UI pra editar caps
**Por quê não:** caps são env vars. Pra time, viraria tabela com RLS para admins.

### 7.4 i18n
**Por quê não:** PT-BR fixo pro contexto do desafio (entrevista BR).

### 7.5 Observabilidade externa (Sentry / Datadog)
**Por quê não:** Vercel Logs + audit_events cobrem o essencial. Pra prod, Sentry é mandatório.

### 7.6 Pagination do histórico de mensagens
**Por quê não:** o compaction já limita a janela ativa; conversas muito antigas acabam compactadas. Pra conversas de 1000+ msgs ainda assim seria útil, mas fica como next step.

### 7.7 MCP Streamable HTTP com `Mcp-Session-Id` real
**Por quê não:** hoje o MCP server próprio é stateless. Spec de março/2025 pede session id resumable. Pra expor pra claude.ai externo seria preciso implementar OAuth 2.1 DCR + session resumption — ~1 dia de código.

### 7.8 Thumbnails de PDFs/imagens no histórico
**Por quê não:** signed URL + lazy loading já é performático. Thumbnail server-side exigiria `sharp` + geração assíncrona.

---

## 8. Perguntas prováveis em entrevista + respostas

### "Por que não usou LangChain?"
> Overkill. O AI SDK já abstrai o que eu precisava (streaming, tool calls, MCP). LangChain adicionaria uma camada de indireção e documentação instável sem benefício no escopo.

### "Por que não separou backend?"
> O domínio é totalmente server-rendered + API. Next com App Router elimina a necessidade de SPA + backend separado — menos deploy, menos CORS, menos boilerplate.

### "Como você garante que RLS está correto?"
> Policies escritas spec-first em SQL versionado. Smoke test manual com 2 contas Google (user A não enxerga conv de user B). Pra prod, teria testes de integração automatizados.

### "Como escalaria pra 1000 users concorrentes?"
> Supabase aguenta no plano Pro (connection pooling + replicas). Vercel escala serverless automaticamente. Bottleneck seria o cap global — removeria ou escalaria por tier. Audit log viraria tabela particionada por mês.

### "O MCP in-memory não compromete o protocolo?"
> Não. O protocolo (initialize → tools/list → tools/call) é idêntico. Só o transport (como as mensagens JSON-RPC viajam) é diferente. Pra servers externos, o transport HTTP continua. Pra interno, o in-memory bypassa a rede — é equivalente a uma shared memory channel que é padrão em implementações MCP locais.

### "Como você sabe que o cap funciona?"
> Pre-check atômico (SUM de `usage_events` do dia + estimated_input). Se exceder, retorna 429 + audit `quota.exceeded` + modal na UI. Testado manualmente baixando o cap pra 1000 tokens.

### "Por que PostgreSQL e não um banco serverless (DynamoDB, etc.)?"
> O domínio é relacional (users 1:N conversations, 1:N messages, 1:N attachments, 1:N tool_invocations, 1:N shares). RLS no Postgres resolve autorização em uma camada. DynamoDB resolveria em código, com mais trabalho.

### "O que você refatoraria se tivesse mais 2 dias?"
> 1. Testes (Vitest + Playwright).
> 2. MCP via Streamable HTTP com `Mcp-Session-Id` real (hoje é stateless).
> 3. Observabilidade: Sentry no cliente + traces OTel no server.
> 4. Separar o audit log em worker (SQS-like) pra não bloquear requests.

### "Como você garantiu que nada vaza no browser?"
> Service role key nunca com prefixo `NEXT_PUBLIC_`. Fetch do browser sempre vai pro `/api/*` que é server. API routes retornam só o que o user autenticado pode ver. RLS como última linha de defesa.

### "Por que não AWS?"
> #prazo. AWS exige setup de VPC/IAM/RDS/S3/Lambda — fácil 2 dias só pra config. Supabase + Vercel entregam o mesmo em 1h. Em um ambiente corporativo com time, AWS faria mais sentido pela flexibilidade.

### "Por que `after()` do Next em vez de uma queue?"
> Compaction é 1 operação atômica (summarize + insert + update). Não precisa de retry, dead-letter queue ou visibility timeout. `after()` cumpre em 1 linha. Se virasse pipeline de N etapas, migraria pra queue (SQS, Inngest, BullMQ).

---

## 9. Métricas (concretas pra citar)

- **10+ commits** com Discovery → PRD → Arch → Specs → Code em cada rodada.
- **~20 rotas** (API + páginas).
- **11 tabelas** com RLS.
- **15 env vars** validadas por `scripts/check-env.ts`.
- **120+ tasks** no backlog, 100% das obrigatórias + diferenciais R2/R3.
- **24 testes unit** (Vitest) + **4 smoke tests** (Playwright).
- **3h de planejamento** + ~30h de código. Prazo: 72h.
- **Build limpo** (zero warnings).
- **1 bug sério em produção resolvido** — MCP `fetch failed` em Vercel serverless → fix com in-memory transport, 40 linhas.
- **Economia de tokens pós-R3:** ~70% de input em conversas longas (prompt caching) + ~90% de bandwidth em conversas com anexos (signed URL).

## 10. Perguntas prováveis de Round 3

### "Como você mede se o prompt caching está funcionando?"
> O AI SDK repassa `cache_read_input_tokens` nos logs do `onFinish`. Em uma conversa de 5 turnos com Sonnet, o 5º turn mostra ~90% dos input tokens vindo do cache. O custo cai de 100% pra 10% nessa parcela.

### "O `client_message_id` resolve idempotência de verdade?"
> Pra retries do mesmo client sim — índice único `(conversation_id, client_message_id)` + `ON CONFLICT DO NOTHING`. Pra ataques (user malicioso enviando ids iguais em paralelo), o DB impede dupla inserção; mas o cap de tokens já faz o pre-check atômico. Em prod com múltiplos clients concorrentes, o `client_message_id` precisaria ser derivado do server (nonce assinado) pra proteção total.

### "Por que `Vercel Cron` e não `pg_cron`?"
> Ambos funcionam. `pg_cron` exige extensão Supabase + função SQL + SECURITY DEFINER. Vercel Cron é 1 linha em `vercel.json` + 1 route handler em TS que já pode usar as libs do projeto (audit, drizzle). Debug com `console.log` direto nos Vercel Logs. Trade-off: minha retention lógica mora em TS; se o Vercel sumir, mora com ele.

### "Mudar modelo no meio da conversa não bagunça o histórico?"
> O histórico é só mensagens; nada no payload amarra a um modelo. O que muda é o estilo da resposta. Testei trocar Sonnet → Opus no meio e a conversa segue naturalmente. Haiku pode "esquecer" nuances do Opus anterior, mas o summary de compaction normaliza o tom se chegar nesse ponto.

### "Tool invocations hidratados — por que não só re-executar as tools no reload?"
> Determinismo + custo. `web_search` em 2 segundos diferentes retorna resultados diferentes; o usuário perderia a referência ao que o modelo viu na hora. E tool calls custam dinheiro + rate limit externo. Persistir args+result no banco é o certo pra audit também.
