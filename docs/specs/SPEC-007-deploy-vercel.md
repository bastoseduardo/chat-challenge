# SPEC-007 — Deploy & delivery

**User stories:** US-027, US-028
**Dependências:** TODAS as outras specs
**Estimativa:** ~2h (deploy) + 1h (vídeo) + 1h (README)

> **Nota:** snapshot da fase de Planning. Decisões tomadas durante a implementação
> estão em [`../03-decisions.md`](../03-decisions.md) a partir de §3.11.

## Objetivo
Entregar link público funcional em `.vercel.app`, repo com README completo e vídeo demo de 3-4 min.

## Acceptance criteria

- [ ] AC-1 Repo público no GitHub (ou acesso compartilhado) com código completo.
- [ ] AC-2 Deploy no Vercel conectado ao GitHub (push na main → auto-deploy).
- [ ] AC-3 Env vars configuradas no Vercel dashboard (ver [02-architecture.md §6](../02-architecture.md)).
- [ ] AC-4 Supabase em produção com migrations aplicadas (via `drizzle-kit push` ou `drizzle-kit migrate`).
- [ ] AC-5 Google OAuth configurado no GCP com callback de produção.
- [ ] AC-6 Smoke test manual completo no deploy público (golden path funciona).
- [ ] AC-7 README.md inclui:
  - Descrição + screenshots
  - Link do deploy público
  - Link do vídeo (YouTube unlisted ou Loom)
  - Setup local (clone, env, drizzle, dev)
  - Decisões técnicas (resumo dos ADRs)
  - Mapa de features vs requisitos do briefing
- [ ] AC-8 Vídeo 3-4 min cobre todos os 9 passos do golden path.
- [ ] AC-9 Vídeo hospedado publicamente e permanece ativo por ≥1 semana.
- [ ] AC-10 Email de entrega enviado com: link deploy + link vídeo + link repo.

## Checklist pré-deploy (#EXPORT_CRITICAL)

- [ ] Todas RLS habilitadas e testadas com 2 users
- [ ] `SUPABASE_SERVICE_ROLE_KEY` apenas no server
- [ ] Nenhum `console.log` de dados sensíveis
- [ ] `.env.local` no `.gitignore`
- [ ] Build local passa (`pnpm build`)
- [ ] Smoke test local completo
- [ ] Error boundaries nos pages principais
- [ ] 404/500 pages customizadas

## Tasks

1. [ ] `pnpm build` local sem warnings
2. [ ] Git repo inicializado + .gitignore
3. [ ] Push inicial para GitHub
4. [ ] Vercel: import project + env vars
5. [ ] Supabase prod: aplicar migrations
6. [ ] GCP: adicionar callback de produção ao OAuth app
7. [ ] Supabase: adicionar redirect URL de produção
8. [ ] Primeiro deploy + smoke test
9. [ ] Gravar vídeo (Loom ou OBS → YouTube unlisted)
10. [ ] Escrever README executivo
11. [ ] Email de entrega

## Riscos
- **OAuth callback mismatch** → testar deploy no Dia 1 pra pegar cedo.
- **Env var faltando quebra build** → script `scripts/check-env.ts` que valida presença.
- **Migrations falham em prod** → aplicar via `drizzle-kit migrate` com `DIRECT_URL`.

## Email de entrega (template)

```
Olá, [Nome],

Entregando o desafio técnico.

- Deploy público: https://chat-challenge.vercel.app
- Vídeo demo: [link]
- Repositório: [link]

Login via Google. Todos os requisitos obrigatórios atendidos + MCP support
como diferencial. Decisões técnicas detalhadas no README.

À disposição,
Eduardo
```
