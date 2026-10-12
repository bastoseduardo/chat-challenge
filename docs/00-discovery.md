# Discovery — Chat Challenge

**Prazo:** 2026-10-15, 12h00 (BRT)
**Hoje:** 2026-10-12
**Janela útil:** ~72h
**Autor:** Eduardo de Melo Bastos

---

## 1. Objetivo

Construir e disponibilizar publicamente uma aplicação de chat multi-conversa, com integração de tools externas (web search, scraping, MCP), suporte a vision/PDF, compartilhamento read-only, auto-compaction de contexto, cap de tokens com contabilização, e audit log completo.

---

## 2. Requisitos obrigatórios (traçados do briefing)

| # | Requisito | Spec que resolve |
|---|---|---|
| R1 | Múltiplas conversas + persistência de histórico | SPEC-001 |
| R2 | Tools: internet + web scraping | SPEC-003 |
| R3 | Vision (imagens) | SPEC-002 |
| R4 | PDFs no chat | SPEC-002 |
| R5 | Compartilhar conversa (read-only público) | SPEC-006 |
| R6 | Deploy em cloud, link público | SPEC-007 |
| R7 | DB para users/conversas/msgs/configs/tools/estados | SPEC-001 (transversal) |
| R8 | Auto-compaction ao atingir limite de contexto | SPEC-004 |
| R9 | Cap de créditos/tokens + contabilização | SPEC-005 |
| R10 | Audit log completo | SPEC-005 |

**Diferenciais (prioridade decrescente):**

- D1. **MCP support** — essencial pra pontuar (prioridade 2)
- D2. Google Drive connector — se der tempo (prioridade 1)
- D3. Gmail connector — se der tempo (prioridade 1)

---

## 3. Stack decidida

| Camada | Escolha | Motivo (#PATH_DECISION) |
|---|---|---|
| Framework | Next.js 15 App Router + TS | Rotas de API + SSR + deploy 1-click no Vercel |
| LLM SDK | Vercel AI SDK v5 | Tool calling, streaming, vision, MCP client — tudo abstraído |
| Modelo | Claude Sonnet 4.6 | 200k ctx, vision nativo, bom tool use, custo baixo |
| DB | Supabase Postgres | Já tem conta; Postgres sério; RLS pronto |
| ORM | Drizzle | Type-safe + migrations rápidas; melhor DX que Prisma pro timeline |
| Auth | Supabase Auth (Google) | 2 cliques no dashboard; access_token reusa pra Gmail/Drive |
| Storage | Supabase Storage | Elimina Vercel Blob; mesma conta do DB |
| Web search tool | Tavily | 1k req/mês free, 1 endpoint |
| Web scrape tool | Jina Reader (`r.jina.ai/<url>`) | Sem key, retorna markdown pronto |
| MCP | AI SDK MCP client via config JSON | 1h de trabalho; evita UI de gerência |
| Deploy | Vercel | Push → URL pública; integra Supabase |
| Observabilidade | Postgres `audit_events` + console logs | Suficiente pro escopo; sem Datadog/Sentry |

---

## 4. Decisões capturadas (33 pontos de discovery)

### Chat core
- **D1** Modelo único: Claude Sonnet 4.6.
- **D2** Sem seletor multi-modelo no MVP.
- **D3** Streaming token-a-token (SSE via AI SDK).
- **D4** Sem edição/regeneração de mensagens.
- **D5** Markdown rendering + syntax highlight (react-markdown + rehype-highlight).

### Attachments (imagem + PDF)
- **D6** Limites: 10 MB imagem / 20 MB PDF.
- **D7** PDF: enviado em bytes direto ao Claude (vision nativo). Sem extração local.
- **D8** Até 5 anexos por mensagem.
- **D9** Supabase Storage, bucket `chat-attachments`, URLs assinadas (TTL curto).

### Tools
- **D10** Built-in: `web_search` (Tavily) + `web_scrape` (Jina) + `get_current_time`.
- **D11** Toggle on/off por conversa (configurações).
- **D12** MCP via config JSON nas settings do usuário (sem UI de gerência).
- **D13** Um MCP server próprio no demo (ex.: "notas pessoais" ou "memória do usuário") — mostra o loop end-to-end no vídeo.

### Auto-compaction
- **D14** Trigger: 80% do context window (≈160k tokens de 200k).
- **D15** Estratégia: resumir mensagens antigas em uma `summary message` + manter N mais recentes. Chamada LLM extra pro resumo.
- **D16** UX: silencioso + badge discreto no header ("Histórico comprimido Nx").

### Cap de tokens
- **D17** Dois níveis: por-usuário (ex.: 100k tokens/dia) **e** global da aplicação (ex.: 2M tokens/dia).
- **D18** Ao estourar: bloqueia envio com modal "limite atingido".
- **D19** Contabiliza tokens (input+output) **e** custo USD calculado.
- **D20** Caps fixos via env vars no MVP.

### Audit log
- **D21** Eventos: `user.login`, `user.logout`, `conversation.{created,deleted,shared,unshared}`, `message.{sent,received}`, `tool.invoked`, `attachment.uploaded`, `compaction.executed`, `quota.exceeded`, `mcp.server.connected`.
- **D22** Página `/admin/audit` read-only com tabela filtrada.

### Share
- **D23** Público read-only com token randômico (`/share/<token>`).
- **D24** Live view (reflete mensagens novas em tempo real; filtro no SELECT).
- **D25** Revogável (`revoked_at` + 404 após revogação).
- **D26** Anexos visíveis via URL assinada.

### Auth
- **D27** Google OAuth via Supabase Auth. Único método de login.
- **D28** ~~`/demo` route~~ — **descartado**. Avaliador loga com Google.

### Deploy
- **D29** Vercel + Supabase.
- **D30** Domínio padrão `.vercel.app`.

### Diferenciais
- **D31** Prioridades: MCP (2 — core do diferencial), Drive (1), Gmail (1).

### Entrega
- **D32** Vídeo 3-4 min. Roteiro: criar conversa → vision (imagem) → PDF → tool search → MCP tool → share link → cap sendo contabilizado → audit log.
- **D33** README executivo (setup, env vars, decisões, screenshots, link deploy, link vídeo).

---

## 5. Não-objetivos (fora de escopo)

- Edição/regeneração de mensagens
- Multi-modelo com seletor na UI
- UI de admin para editar caps
- Rota `/demo` anônima
- Testes E2E extensivos (apenas smoke manual)
- Internacionalização (PT-BR fixo)
- Mobile dedicated UI (responsivo básico apenas)
- Rate limiting fino por endpoint (só o cap de tokens)
- Observabilidade externa (Datadog/Sentry)

---

## 6. Premissas

- **A1** Conta Supabase ativa com projeto novo criado no Dia 1.
- **A2** Anthropic API key com créditos suficientes pra ~300k tokens de dev + 200k demo.
- **A3** Tavily key free tier suficiente (<1000 req/mês).
- **A4** Google OAuth app criado no GCP Console (callback: `<supabase-url>/auth/v1/callback`).
- **A5** Vercel conectado ao GitHub repo (deploy automático via push na main).
- **A6** Avaliador acessa o link público e testa via login Google próprio.

---

## 7. Riscos (#PLAN_UNCERTAINTY)

| Risco | Impacto | Mitigação |
|---|---|---|
| Timeline 72h apertado | Alto | Caminho crítico definido; diferenciais só no Dia 3 à tarde |
| Compaction pode degradar qualidade | Médio | Prompt de summarization bem calibrado; log de antes/depois |
| MCP integration mais complexa que estimado | Médio | Fallback: suporte MCP só via STDIO local, server próprio pré-construído |
| Cap de tokens com race condition (contagem concorrente) | Médio | Transação atomic no update; margem de segurança 5% |
| Supabase RLS mal configurado expõe dados | Alto (#EXPORT_CRITICAL) | Policies escritas spec-first, revisão antes do deploy |
| Google OAuth em produção falha por domínio não autorizado | Médio | Testar no primeiro deploy no Dia 1 |
| PDF/imagem muito grandes estouram request | Baixo | Validação client-side + server-side; retornar erro amigável |

---

## 8. Caminho crítico (ordem de dependências)

```
Setup (Supabase + Vercel + repo) 
  → Schema + Drizzle migrations
  → Auth Google
  → Chat core (streaming + persistência)
  → Attachments (vision + PDF)
  → Tools (search + scrape)
  → Auto-compaction
  → Cap de tokens + audit log
  → Share
  → MCP (diferencial)
  → Deploy final + README + vídeo
  → [se sobrar] Drive/Gmail connectors
```

---

## 9. Golden path do vídeo (3-4 min)

1. (0:00) Login com Google → tela inicial com conversas vazias.
2. (0:20) Criar nova conversa, mandar "Me resuma este PDF" + anexar PDF técnico. Resposta streaming.
3. (0:50) Nova mensagem com imagem (print de diagrama). Modelo descreve o conteúdo (vision).
4. (1:20) Perguntar "O que saiu de novo na OpenAI essa semana?" → tool `web_search` é disparada (log visível) → resposta sintetizada com fontes.
5. (1:50) Perguntar algo que requer o MCP server próprio (ex.: "Salve esta decisão nas minhas notas"). Mostra tool call.
6. (2:20) Clicar "Compartilhar" → copiar link → abrir em aba anônima → mostrar read-only funcionando.
7. (2:50) Abrir painel de uso: mostrar tokens consumidos + custo USD + barra do cap.
8. (3:10) Abrir `/admin/audit` → mostrar lista de eventos (login, msg, tool, share, compaction).
9. (3:30) Fechamento rápido: "deploy em `<url>.vercel.app`, código em GitHub".

---

## 10. Delivery checklist (#EXPORT_CRITICAL)

- [ ] Link público funcional em `.vercel.app`
- [ ] Login Google operacional
- [ ] Todos os R1-R10 funcionam no deploy final
- [ ] Vídeo 3-4 min gravado e hospedado (Loom/YouTube unlisted)
- [ ] README com link do deploy, link do vídeo, instruções de setup
- [ ] Repo público ou link de acesso compartilhado

---

## 11. Próximos artefatos

- `01-prd.md` — PRD executivo
- `02-architecture.md` — stack final + schema + ADRs leves
- `docs/specs/SPEC-00X-*.md` — 7 specs
- `tasks.md` — checklist flat ordenada

