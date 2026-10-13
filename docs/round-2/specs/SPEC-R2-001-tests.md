# SPEC-R2-001 — Testes automatizados

**Esforço:** ~3h · **Prioridade:** P1

## Objetivo
Suíte mínima de testes que demonstre consciência de qualidade sem engessar o projeto. Unit em libs puros + E2E golden path.

## Acceptance criteria

- [ ] `npm test` roda Vitest com ≥6 unit tests
- [ ] `npm run test:e2e` roda Playwright com 1 teste end-to-end do golden path (login→conv→msg)
- [ ] Build + testes passam no CI local (sem GitHub Actions no MVP)
- [ ] Cobertura mínima dos libs críticos: `pricing`, `tokens`, `caps`, `storage/attachments`

## Dependências de instalação

```
npm i -D vitest @vitest/ui @playwright/test
npx playwright install chromium
```

## Estrutura

```
tests/
├── unit/
│   ├── pricing.test.ts         # costUsd() por modelo
│   ├── tokens.test.ts          # estimateTokens, estimateMessagesTokens
│   ├── caps.test.ts            # readCap, QuotaError
│   └── attachments.test.ts     # detectKind, limits
└── e2e/
    └── golden-path.spec.ts     # login mock + chat send
vitest.config.ts
playwright.config.ts
```

## Tasks

1. [ ] Instalar deps (vitest, playwright)
2. [ ] `vitest.config.ts` com alias `@/*`
3. [ ] `tests/unit/pricing.test.ts` — ≥3 casos (sonnet, opus, modelo desconhecido)
4. [ ] `tests/unit/tokens.test.ts` — ≥3 casos (string vazia, parts text, parts com image)
5. [ ] `tests/unit/caps.test.ts` — testar readCap env + QuotaError shape
6. [ ] `tests/unit/attachments.test.ts` — detectKind image/pdf/invalid
7. [ ] `playwright.config.ts` com baseURL `http://localhost:3000`
8. [ ] `tests/e2e/golden-path.spec.ts` — mocka cookie Supabase (ou pula login via E2E)
9. [ ] Scripts no package.json: `test`, `test:ui`, `test:e2e`
10. [ ] Rodar tudo + ajustar

## Riscos
- Testes E2E com Supabase auth real → complexo. **Mitigação:** mocka cookie `sb-access-token` com JWT fake OU usa um fluxo simplificado só da UI (sem login real).

## #PATH_DECISION
Playwright pra 1 fluxo "happy path" ao vivo — serve de smoke test automatizado. Vitest pros puros. Sem fixtures de banco (fora de escopo).
