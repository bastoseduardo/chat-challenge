# Round 2 — Polish e diferenciais

**Hoje:** 2026-10-13 · **Deadline:** 2026-10-15 12h (BRT) · **Janela útil:** ~45h

MVP já em produção com 100% dos requisitos + MCP. Essa rodada é **polish, qualidade e diferenciais** pra maximizar a nota da entrevista.

---

## Objetivo

Elevar o projeto de "funcional" para "**production-ready junior/pleno**" demonstrando:
- Qualidade (testes automatizados)
- Robustez (rate limiting, erros amigáveis)
- Diferenciais extras (Drive connector, tool streaming visual, dark mode)
- Apresentação (README com screenshots, página de erros)

---

## Escopo (8 itens, ~9h30 estimadas)

| # | Entregável | Esforço | Impacto entrevista | Spec |
|---|---|---|---|---|
| A | Testes (Vitest libs + Playwright E2E golden path) | 3h | **Alto** — checkbox de senioridade | SPEC-R2-001 |
| B | Polish UX: empty states, loading skeletons, 404/500 | 1h | Médio-alto | SPEC-R2-002 |
| C | Google Drive connector (tool `drive_read_file`) | 2h | **Alto** — 2º diferencial | SPEC-R2-003 |
| D | Streaming visual de tool calls (card com args/result ao vivo) | 1h | Médio | SPEC-R2-004 |
| E | Dark mode toggle | 30min | Baixo-médio | SPEC-R2-002 |
| F | Modal "quota exceeded" com CTA pra `/usage` | 30min | Médio | SPEC-R2-002 |
| G | Rate limiting por IP (Upstash Ratelimit free tier) | 1h | Médio-alto | SPEC-R2-005 |
| H | Screenshots no README (fluxo visual) | 30min | **Alto** — 1º contato | SPEC-R2-006 |

**Ordem de execução** (dependências + ROI):
1. SPEC-R2-002 (polish + dark + quota modal) — base pros screenshots
2. SPEC-R2-004 (tool streaming) — melhora visual pros screenshots
3. SPEC-R2-003 (Drive connector) — diferencial grande
4. SPEC-R2-005 (rate limiting) — robustez
5. SPEC-R2-001 (testes) — qualidade
6. SPEC-R2-006 (screenshots README) — depende de todos acima

---

## Fora de escopo (ainda)

- Email magic link
- Admin UI pra editar caps
- Multi-model com seletor
- Edição/regeneração de mensagens
- i18n
- Observabilidade externa (Sentry)
- Testes com fixtures Supabase (RLS cross-user) — considerado mas 2h extra

---

## Métricas de sucesso

- `npm test` passa com ≥10 testes (unit + e2e)
- Dark mode funciona sem flash of unstyled content
- Drive connector completa fluxo real (ler file do Drive do usuário)
- README tem ≥4 screenshots cronometrados
- Rate limiting bloqueia 11º request em 1 min (teste manual)
- Build limpo, zero warnings

---

## Riscos

| Risco | Mitigação |
|---|---|
| Playwright complexo em CI | Rodar local, não bloqueia prod |
| Upstash Ratelimit API muda | Fallback: implementação simples com Postgres |
| Drive OAuth scope precisa approval | Começar com scope mínimo `drive.readonly` |
| Dark mode flash | `next-themes` já instalado, mitigação pronta |
