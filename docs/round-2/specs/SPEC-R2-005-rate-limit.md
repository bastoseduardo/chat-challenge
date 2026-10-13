# SPEC-R2-005 — Rate limiting por IP

**Esforço:** ~1h · **Prioridade:** P1

## Objetivo
Proteger `/api/chat` e `/api/attachments/upload` de abuse por IP, independente do cap de tokens (que depende do user_id).

## Decisão de implementação

Opção A: **Upstash Ratelimit** (serverless, free tier 10k/dia). Precisa de 1 conta extra.
Opção B: **Postgres bucket** (sem deps externas, uma tabela `rate_limits`).

**Escolha:** B — mantém zero deps externas, zero cadastros extras pro avaliador. Perda: um pouco mais de código (~30 linhas).

## Acceptance criteria

- [ ] `/api/chat` bloqueia IP após 10 requests/minuto com 429
- [ ] `/api/attachments/upload` bloqueia após 20 requests/minuto
- [ ] Response inclui header `Retry-After`
- [ ] Audit event `quota.exceeded` com scope `ip_rate_limit`
- [ ] Teste manual: 11 submits rápidos → 11º bloqueado

## Modelo de dados

```sql
create table rate_limit_buckets (
  key          text primary key,       -- ex: "chat:1.2.3.4"
  window_start timestamptz not null,
  count        int not null default 0
);
```

## Implementação

```ts
// lib/rate-limit.ts
export async function assertRateLimit(opts: {
  key: string         // ex: `chat:${ip}`
  limit: number       // ex: 10
  windowMs: number    // ex: 60000
}): Promise<void>
```

Algoritmo:
- SELECT bucket por key
- Se `now - window_start >= windowMs` → reset (count=1, window_start=now)
- Se count < limit → increment, OK
- Senão → throw

Transação pequena, 1 roundtrip.

## Tasks

1. [ ] Migration: tabela `rate_limit_buckets` (schema Drizzle + SQL)
2. [ ] `lib/rate-limit.ts` com `assertRateLimit`
3. [ ] Helper `getClientIp(req)` lendo `x-forwarded-for` (Vercel) ou `x-real-ip`
4. [ ] Integrar em `/api/chat` (limit 10/min)
5. [ ] Integrar em `/api/attachments/upload` (limit 20/min)
6. [ ] Response 429 + `Retry-After` header
7. [ ] Audit event
8. [ ] Documentar os limites no README

## Riscos
- IP compartilhado (NAT) pode penalizar outros users. Mitigado pelo cap generoso (10/min).
- Falta de janela deslizante → aceita rajada no "virar" da janela. OK pro escopo.
