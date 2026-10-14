# SPEC-005 — Cap de tokens & Audit log

**User stories:** US-017, US-018, US-019, US-020, US-025, US-026
**Dependências:** SPEC-001
**Estimativa:** ~4h

> **Nota:** snapshot da fase de Planning. Decisões tomadas durante a implementação
> estão em [`../03-decisions.md`](../03-decisions.md) a partir de §3.11.

## Objetivo
Contabilizar consumo (tokens + USD) por request; impor cap diário por-usuário e global; bloquear quando estourar; registrar todos eventos relevantes em `audit_events` e expor em `/admin/audit`.

## Acceptance criteria

### Caps & usage
- [ ] AC-1 Toda chamada LLM (chat ou compaction) insere `usage_events`.
- [ ] AC-2 Cálculo: `cost_usd = (input*price_in + output*price_out) / 1e6`.
- [ ] AC-3 Pré-check antes de `streamText`:
  - sum(user_tokens_today) + estimated_input > USER_DAILY_TOKEN_CAP → 429
  - sum(global_tokens_today) + estimated_input > GLOBAL_DAILY_TOKEN_CAP → 429
- [ ] AC-4 Modal "limite atingido" na UI quando 429 retorna.
- [ ] AC-5 Página `/usage` mostra: tokens hoje, custo USD hoje, barra de progresso vs cap.
- [ ] AC-6 Agregação em `created_at >= date_trunc('day', now())`.

### Audit
- [ ] AC-7 `audit_events` registra todos os eventos listados em [Discovery §4 D21](../00-discovery.md).
- [ ] AC-8 `/admin/audit` lista eventos paginados, filtro por `event_type`, `user_id`, data.
- [ ] AC-9 Acesso ao `/admin/audit` restrito (claim `is_admin=true` no profile ou allowlist via env).
- [ ] AC-10 Metadata preserva info útil (ex.: tool.invoked guarda `tool_name`, `duration_ms`).

## Modelo de dados
`usage_events`, `audit_events`, `profiles.is_admin` (adicionar coluna).

## Preço (hardcoded)

```ts
const PRICING = {
  'claude-sonnet-4-6': { input: 3, output: 15 },  // USD per 1M
  'claude-opus-4-7':   { input: 15, output: 75 },
}
```

## API

| Method | Path | Função |
|---|---|---|
| GET | `/api/usage/me` | agrega hoje |
| GET | `/api/admin/audit` | lista paginada (admin) |

## Helpers

```ts
// lib/usage/caps.ts
export async function assertWithinCaps(userId, estimatedTokens) {
  const [userToday, globalToday] = await Promise.all([
    sumTokensToday(userId),
    sumTokensTodayAll(),
  ])
  if (userToday + estimatedTokens > USER_DAILY_TOKEN_CAP)
    throw new QuotaError('user')
  if (globalToday + estimatedTokens > GLOBAL_DAILY_TOKEN_CAP)
    throw new QuotaError('global')
}

// lib/audit/log.ts
export async function logAudit(eventType, data) {
  await db.insert(auditEvents).values({ event_type: eventType, ...data })
}
```

## Lista de eventos auditados

| Event type | Metadata chaves |
|---|---|
| `user.login` | provider |
| `user.logout` | — |
| `conversation.created` | title |
| `conversation.deleted` | — |
| `conversation.shared` | token |
| `conversation.unshared` | — |
| `message.sent` | role, has_attachments, chars |
| `message.received` | input_tokens, output_tokens, cost_usd, model |
| `tool.invoked` | tool_name, tool_source, duration_ms, success |
| `attachment.uploaded` | kind, size_bytes |
| `compaction.executed` | tokens_before, tokens_after, messages_summarized |
| `quota.exceeded` | scope (user/global), estimated |
| `mcp.server.connected` | server_name |

## Tasks

1. [ ] Migration: `usage_events`, `audit_events`, `profiles.is_admin`
2. [ ] `lib/usage/pricing.ts` + `cost(model, in, out)`
3. [ ] `lib/usage/counter.ts` com `recordUsage()`
4. [ ] `lib/usage/caps.ts` com `assertWithinCaps()`
5. [ ] `lib/audit/log.ts` com `logAudit()`
6. [ ] Integrar em `/api/chat` (pre-check + post-record)
7. [ ] Integrar em compaction
8. [ ] Integrar `logAudit` em todos eventos (hooks nas routes)
9. [ ] Página `/usage` — client + API
10. [ ] Página `/admin/audit` — guard + tabela paginada
11. [ ] Modal "quota exceeded" no chat

## Riscos
- **Race condition no cap** (dois requests simultâneos) → margem 5% + aceita over-count pequeno; auditar.
- **`estimated_input`** → aproximação; usar `countTokens` da Anthropic se disponível, senão `chars/4`.

## #PATH_DECISION
Pre-check otimista com margem, não advisory lock. Simples; o pior caso é um request a mais.
