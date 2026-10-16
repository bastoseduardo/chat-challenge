# Round 4: Tasks

**Plano:** `docs/round-4/00-plan.md` · **Specs:** `docs/round-4/specs/`
**Branch base:** `ux/round-4` (criada a partir de `ux/round-3`). Cada spec roda na própria branch `r4/<id>-<nome>` saindo de `ux/round-4` e volta por merge pra `ux/round-4`.

Marque `[x]` ao concluir. IDs `R4xxx` são estáveis: as specs referenciam os mesmos IDs.

---

## Convenções (valem pra toda spec)

1. **Validar em dev, logado.** `npm run dev` + botão "Entrar sem Google (dev)" (`/auth/dev-login`, exige `DEV_LOGIN_EMAIL` no `.env.local`). Validar com Playwright (screenshots desktop 1440 e mobile 390, claro e escuro) antes de dar a spec por pronta.
2. **O banco de dev É o banco de produção.** Tudo que for criado em teste (conversas, notas, shares) é apagado no fim da validação. Nunca rodar SQL destrutivo.
3. **Migrações só aditivas.** Colunas novas sempre `NULL`-áveis ou com default; nada de renomear ou apagar coluna. O app da `main` precisa continuar funcionando com o schema novo.
4. **Migrações escritas à mão, idempotentes.** *(Revisado na R4-004.)* O journal do drizzle-kit parou na 0002 (a 0003 já foi manual), então `db:generate` está fora de sincronia e **não deve ser usado**: geraria de novo colunas que já existem. Cada spec escreve `drizzle/migrations/000N_<nome>.sql` com `IF NOT EXISTS`, atualiza `lib/db/schema.ts` pra refletir, e aplica com `npx tsx scripts/apply-sql.ts <arquivo>`. Número `N` reservado na ordem de merge (0004 = R4-004; próximas: 0005 R4-007, 0006 R4-006, 0007 R4-008, 0008 R4-012). Funções e policies manuais seguem em `drizzle/sql/00N_*.sql`.
5. **Commit por task ou grupo de tasks, push só quando o autor pedir.**
6. **`globals.css` não recarrega em dev** (Turbopack + loader do Tailwind no Windows): depois de editar, parar o servidor, apagar `.next/dev` e subir de novo.
7. **Qualidade mínima de saída:** `npx tsc --noEmit` limpo, `npx eslint app components lib hooks tests` sem erros, `npm test` e `npx playwright test` passando, axe sem violações nas telas tocadas (script em `docs/round-4/specs/SPEC-R4-000-contratos.md`).
8. **Texto da interface:** português, verbos diretos, sem caixa alta em rótulos, erro diz o que fazer (guia de copy do Round 3, `docs/round-3/00-plan.md` §5).

---

## Mapa de dependências e paralelismo

```
Onda 1 (paralelo)        Onda 2 (paralelo)            Onda 3 (paralelo)          Estica
───────────────────      ─────────────────────        ─────────────────────      ──────────
R4-001 Fundação ───────► R4-003 Citações ───────────► R4-006 Caderno contexto
                    ├──► R4-007 Relatório            ► R4-008 Editar e reenviar
R4-002 Spike ──────────► (decide A/B da R4-003)       ► R4-010 Primeira experiência
R4-004 Caderno dados ──► R4-005 Caderno UI ──────────►  (usa 003 + 005)
R4-009 Detalhes (modelo, voz)                                                  R4-012 Espaços
R4-011 Login incremental do Drive (P3, qualquer momento)
```

| Spec | Depende de | Pode rodar junto com | Prioridade | Esforço |
|---|---|---|---|---|
| R4-001 Salvar resposta completa + contrato de fontes | — | 002, 004, 009, 011 | P0 | 0,5 d |
| R4-002 Spike de citações | — | 001, 004, 009, 011 | P0 | 2 h |
| R4-003 Citações | 001, 002 | 005, 007 | P0 | 2 d |
| R4-004 Caderno: dados e API | — | 001, 002, 009, 011 | P1 | 1 d |
| R4-005 Caderno: interface | 004 (e 001 pra fonte da nota) | 003, 007 | P1 | 1 d |
| R4-006 Caderno como contexto | 004, 001 | 008, 010 | P1 | 1 d |
| R4-007 Relatório compartilhável | 001 | 003, 005 | P1 | 1,5 d |
| R4-008 Editar e reenviar | 001 | 006, 010 | P2 | 1 d |
| R4-009 Modelo na resposta + ditado | — | qualquer | P2 | 0,5 d |
| R4-010 Primeira experiência | 003, 005 | 006, 008 | P0 (demo) | 1 d |
| R4-011 Login sem pedir o Drive | — | qualquer | P3 | 0,5 d |
| R4-012 Espaços de pesquisa | 001, 003 | — | Estica | 3 d |

### Arquivos de conflito (quem toca o quê)

| Arquivo | Specs | Regra |
|---|---|---|
| `app/api/chat/route.ts` | 001, 003, 006, 008 | Uma por vez, na ordem 001 → 003 → 006 → 008. Rebase obrigatório antes do merge |
| `components/chat/message-bubble.tsx` | 003, 005, 008, 009 | 003 é dona do `AssistantMessage`. 005, 008 e 009 adicionam componentes **novos** e só plugam com 1–3 linhas no bubble |
| `components/chat/chat-view.tsx` | 008, 010 | 010 só troca o `EmptyState`; 008 mexe no envio |
| `lib/db/schema.ts` | 004, 007, 008, 012 | Ver convenção 4 |
| `drizzle/sql/003_share_function.sql` → nova versão | 007, 008 | 007 cria `drizzle/sql/006_share_function_v2.sql`; 008 rebaseia e estende |
| `lib/db/queries/messages-with-attachments.ts` | 001, 008 | 001 primeiro |
| `components/chat/sidebar.tsx` | 005, 012 | 005 só adiciona 1 item de menu |

### Ordem de merge em `ux/round-4`
1. R4-001 → 2. R4-002 (só docs) → 3. R4-004 → 4. R4-009 → 5. R4-003 → 6. R4-007 → 7. R4-005 → 8. R4-006 → 9. R4-010 → 10. R4-008 → 11. R4-011 → 12. R4-012

---

## Pendências fora das specs

- [ ] **SEC-01 · Levar a correção da rota MCP pra `main` (produção).** `POST /api/mcp/user-notes` em produção aceita `X-User-Id` sem verificar a sessão: um usuário logado consegue ler e gravar notas de outra conta. Corrigido na R4-004 (`app/api/mcp/user-notes/route.ts`, commit `20b536b`). Falta aplicar na `main`: cherry-pick só desse arquivo num hotfix e deploy. Exposição atual limitada (app OAuth em modo de teste, só usuários cadastrados). **Fazer antes da avaliação.**

## Tasks

### R4-001 · Salvar resposta completa + contrato de fontes (P0)
- [x] R4001 `toUIMessageStreamResponse({ sendSources: true, ... })` no `/api/chat`
- [x] R4002 Persistir a `UIMessage` final (parts completas) no `onFinish` do stream; truncar `output` de ferramentas > 8 KB ao salvar
- [x] R4003 Remover a gravação "só texto" do `onFinish` do `streamText`, mantendo tokens, usage, audit, tool_invocations, embedding e compactação
- [x] R4004 `listMessagesWithAttachments`: usar parts salvas quando existirem; manter remontagem pras mensagens antigas
- [x] R4005 `lib/sources/types.ts` + `lib/sources/extract.ts` (`extractSources`, `sourceLabel`) conforme contrato
- [x] R4006 Testes unitários de `extractSources` (web, documento com página, duplicadas, mensagem sem fontes)
- [x] R4007 Validação: recarregar mantém parts idênticas ao stream (Playwright logado)

### R4-002 · Spike de citações (P0)
- [x] R4011 Script isolado em `scripts/spike-citations.ts` (nativa `20260209`, nativa básica `20250305`, Tavily)
- [x] R4012 Mesmo script com PDF anexado + `citations.enabled`
- [x] R4013 Registrar: ordem das parts (texto e source intercalados?), custo, latência, 5 perguntas reais vs Tavily
- [x] R4014 Escrever a decisão A/B em `docs/round-4/decisions/citations.md` e atualizar a R4-003

### R4-003 · Citações (P0)
- [x] R4021 Anexos PDF com `providerOptions.anthropic.citations` + título no `buildContext`
- [x] R4022 Web: ferramentas nativas básicas (`webSearch_20250305` + `webFetch_20250910`), decisão A do spike
- [x] R4023 Ajuste da instrução de sistema sobre fontes
- [x] R4024 `components/chat/citations.tsx`: marcação `[n]`, cartão da fonte (popover acessível), bloco "Fontes"
- [x] R4025 `AssistantMessage` intercala marcações com o texto conforme a ordem das parts
- [x] R4026 Ligação trilha ↔ marcações (hover/focus destaca o par)
- [x] R4027 Sinal de confiança no rodapé da resposta
- [x] R4028 Copiar resposta e export Markdown com notas de rodapé
- [x] R4029 `research-trail` reconhece `web_search`/`web_fetch` nativas e conta resultados
- [x] R4030 Validação: pergunta com busca + pergunta sobre PDF, recarregar, axe, mobile

### R4-004 · Caderno: dados e API (P1)
- [x] R4041 Schema: colunas novas em `user_notes` (SQL esperado na spec)
- [x] R4042 `lib/db/queries/notes.ts`: criar, listar, buscar (texto + vetor), atualizar, soft delete, restaurar
- [x] R4043 Embedding em background ao criar/editar
- [x] R4044 Rotas `GET/POST /api/notes`, `PATCH/DELETE /api/notes/[id]`, `GET /api/notes/search`
- [x] R4045 MCP `user-notes` passa a usar as mesmas queries (notas do chat aparecem no Caderno)
- [x] R4046 Audit: `note.created`, `note.deleted`
- [x] R4047 Testes unitários da validação de payload

### R4-005 · Caderno: interface (P1)
- [ ] R4051 Item "Caderno" na sidebar + rota `/caderno` no shell
- [ ] R4052 Lista com busca, filtro por conversa, editar inline, apagar com "Desfazer"
- [ ] R4053 `SelectionToSave`: seleção de texto em resposta mostra "Guardar no caderno"
- [ ] R4054 Ação "Guardar resposta" nas ações da mensagem
- [ ] R4055 Toast "Guardado no caderno" com "Abrir"
- [ ] R4056 Nota mostra origem (conversa `#msg-`, fonte)
- [ ] R4057 Grupo "No caderno" no Ctrl+K
- [ ] R4058 Validação + E2E opcional (`E2E_DEV_LOGIN=1`)

### R4-006 · Caderno como contexto (P1)
- [ ] R4061 Busca das 3 notas mais similares por mensagem (limiar configurável)
- [ ] R4062 Injeção como contexto marcado no `/api/chat`
- [ ] R4063 Data part `data-notes-used` no stream + passo "Consultou N notas do caderno" na trilha
- [ ] R4064 Interruptor em Configurações (`user_settings.use_notes_context`)
- [ ] R4065 Validação: guardar nota → conversa nova → passo aparece e a resposta usa a nota

### R4-007 · Relatório compartilhável (P1)
- [x] R4071 Coluna `shares.summary` + `summary_generated_at`
- [x] R4072 Geração do resumo ao compartilhar + "Gerar de novo"
- [x] R4073 `drizzle/sql/006_share_function_v2.sql` devolvendo `summary` (+ migração `0005_share_summary.sql`)
- [x] R4074 Página de relatório: cabeçalho, resumo, conversa, "Fontes consultadas"
- [x] R4075 CSS de impressão + "Baixar PDF"
- [x] R4076 Open Graph (título + resumo)
- [x] R4077 Validação: deslogado, desktop/mobile, PDF impresso

### R4-008 · Editar e reenviar (P2)
- [ ] R4081 Coluna `messages.deleted_at` + filtros em `buildContext`, listagem, export e função de share
- [ ] R4082 `POST /api/conversations/[id]/truncate` (apaga a partir de uma mensagem, bloqueia antes do último resumo)
- [ ] R4083 UI: lápis na mensagem do usuário, edição inline, reenviar
- [ ] R4084 Validação + teste unitário da regra de bloqueio

### R4-009 · Modelo na resposta + ditado (P2)
- [ ] R4091 Metadata do stream inclui `model`; mensagens salvas já têm `messages.model`
- [ ] R4092 Rodapé discreto com o nome do modelo
- [ ] R4093 Botão de ditado (Web Speech API, `pt-BR`), escondido sem suporte
- [ ] R4094 Validação

### R4-010 · Primeira experiência (P0 pra demo)
- [ ] R4101 Tela de boas-vindas quando o usuário não tem conversas
- [ ] R4102 "Ver uma pesquisa de exemplo" dispara pergunta curada
- [ ] R4103 Painel "O que observar" (4 itens, persistido em `localStorage`, dispensável)
- [ ] R4104 Roteiro de 3 minutos + GIF no README
- [ ] R4105 Validação com conta sem conversas (criar conta de teste ou filtrar)

### R4-011 · Login sem pedir o Drive (P3)
- [ ] R4111 Login só com escopos básicos
- [ ] R4112 Ligar ferramenta do Drive em Configurações dispara autorização incremental
- [ ] R4113 Mensagem clara quando a ferramenta do Drive roda sem permissão

### R4-012 · Espaços de pesquisa (Estica)
- [ ] R4121 Tabelas `projects`, `project_sources`, `conversations.project_id`
- [ ] R4122 CRUD de projetos + upload de fontes
- [ ] R4123 Fontes do projeto entram como documentos com citações + prompt caching
- [ ] R4124 Sidebar agrupada por projeto
- [ ] R4125 Validação com 3 PDFs
