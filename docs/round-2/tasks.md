# Round 2 — Tasks

**Deadline:** 2026-10-15 12h · **Hoje:** 2026-10-13
**Lista flat ordenada pelo caminho crítico. Marque com [x] ao completar.**

---

## 🟢 Bloco 1 — UX Polish (SPEC-R2-002) — ~2h

- [ ] R201 next-themes ThemeProvider wrapper
- [ ] R202 `suppressHydrationWarning` no `<html>`
- [ ] R203 Theme toggle component (sol/lua)
- [ ] R204 Toggle no footer da sidebar
- [ ] R205 Empty state da sidebar (0 conversas)
- [ ] R206 Chat empty state com 4 chips sugeridos
- [ ] R207 `app/usage/loading.tsx`
- [ ] R208 `app/admin/audit/loading.tsx`
- [ ] R209 `app/c/[id]/loading.tsx`
- [ ] R210 `app/not-found.tsx` global
- [ ] R211 `app/c/[id]/not-found.tsx`
- [ ] R212 `app/share/[token]/not-found.tsx`
- [ ] R213 `app/error.tsx` global com reset
- [ ] R214 Quota exceeded dialog com link /usage
- [ ] R215 Smoke local

## 🟢 Bloco 2 — Tool streaming visual (SPEC-R2-004) — ~1h

- [ ] R216 Extrair `<ToolCallCard>` component
- [ ] R217 Switch dos 4 estados do UIMessagePart
- [ ] R218 Prettify tool name (split `__`, title case)
- [ ] R219 Collapsible com useState
- [ ] R220 Ícones por estado
- [ ] R221 Formatter args/result (JSON indent)

## 🟡 Bloco 3 — Drive connector (SPEC-R2-003) — ~2h

- [ ] R222 Atualizar `login/page.tsx` com scope `drive.readonly`
- [ ] R223 `lib/ai/tools/drive-search.ts`
- [ ] R224 `lib/ai/tools/drive-read.ts`
- [ ] R225 Expor em `tools/index.ts` + types
- [ ] R226 Switch no `/settings` (default OFF)
- [ ] R227 Fetch provider_token no `/api/chat`, injetar como contexto
- [ ] R228 Tratamento erro 401 "reconecte Google"
- [ ] R229 Audit event
- [ ] R230 Smoke manual (login novo pra pegar scope + testar tool)

## 🟡 Bloco 4 — Rate limiting (SPEC-R2-005) — ~1h

- [ ] R231 Schema Drizzle: `rate_limit_buckets`
- [ ] R232 Migration SQL + rodar manual no Supabase
- [ ] R233 `lib/rate-limit.ts` com `assertRateLimit`
- [ ] R234 Helper `getClientIp`
- [ ] R235 Integrar `/api/chat` (10/min)
- [ ] R236 Integrar `/api/attachments/upload` (20/min)
- [ ] R237 Response 429 + Retry-After
- [ ] R238 Audit event

## 🟠 Bloco 5 — Testes (SPEC-R2-001) — ~3h

- [ ] R239 npm i -D vitest @vitest/ui @playwright/test
- [ ] R240 `npx playwright install chromium`
- [ ] R241 `vitest.config.ts`
- [ ] R242 `tests/unit/pricing.test.ts`
- [ ] R243 `tests/unit/tokens.test.ts`
- [ ] R244 `tests/unit/caps.test.ts`
- [ ] R245 `tests/unit/attachments.test.ts`
- [ ] R246 `playwright.config.ts`
- [ ] R247 `tests/e2e/golden-path.spec.ts` (login mock + nav)
- [ ] R248 Scripts package.json: test, test:ui, test:e2e
- [ ] R249 `npm test` passa

## 🟣 Bloco 6 — Screenshots README (SPEC-R2-006) — ~30min

- [ ] R250 Rodar prod em dark mode
- [ ] R251 Capturar 6 PNGs
- [ ] R252 Otimizar tamanho
- [ ] R253 Mover pra `docs/screenshots/`
- [ ] R254 Adicionar seção no README
- [ ] R255 Commit + push

---

## Dependências

- R222 (Drive scope) → requer **relogin do user**. Avisar no fim.
- R250 (screenshots) depende de **todo o resto estar deployado** (quer dark mode + tool streaming visual novo).
- Testes podem rodar em paralelo com qualquer bloco (não bloqueiam prod).
