# SPEC-R4-006: Caderno como contexto

**Esforço:** ~1 dia · **Prioridade:** P1 · **Depende de:** 004 (`similarNotes`), 001 (rota do chat estabilizada) · **Bloqueia:** —
**Pode rodar junto com:** 008, 010 (mas mergear antes da 008: ambas mexem em `app/api/chat/route.ts`) · **Tasks:** R4061–R4065

## Objetivo
O que o usuário guardou volta sozinho quando é relevante, e a trilha mostra que voltou.

## Escopo
1. **Busca:** a cada mensagem do usuário, `similarNotes({ userId, text, limit: 3, minSimilarity: 0.55 })` (limiar em constante exportada; ajustar com 5 casos reais e registrar o valor final na spec).
2. **Injeção:** quando houver notas, adicionar ao `system` um bloco **depois** do bloco estável (pra não quebrar o prompt caching do prefixo):
   ```
   Notas que o usuário guardou e que podem ser relevantes (use só se ajudarem; cite como "suas notas"):
   - [nota 1] <quote ou content> (fonte: <sourceLabel>)
   ```
3. **Visível na trilha:** trocar o `return result.toUIMessageStreamResponse(...)` por `createUIMessageStreamResponse({ stream: createUIMessageStream({ execute: ({ writer }) => { writer.write({ type: "data-notes-used", data: { notes: [{ id, title, quote }] } }); writer.merge(result.toUIMessageStream({ /* mesmas opções da R4-001 */ })) } }) })`. Manter `sendSources`, `generateMessageId`, `messageMetadata` e a persistência do `onEnd`.
4. **UI:** `ResearchTrail` (ou `AssistantMessage`) reconhece a parte `data-notes-used` e mostra o passo "Consultou N notas do caderno", clicável, listando as notas com link pra `/caderno`.
5. **Configuração:** `user_settings.use_notes_context boolean not null default true` (aditivo) + switch em Configurações ("Usar o caderno como contexto").
6. Audit: metadata do `message.sent` ganha `notes_used: N`.

## Arquivos
- Modificar: `app/api/chat/route.ts`, `lib/db/schema.ts` (`user_settings`), `components/chat/research-trail.tsx` ou `message-bubble.tsx` (só o reconhecimento da parte), `components/settings/settings-form.tsx`, `app/api/settings/route.ts`

## Acceptance criteria
- [ ] Guardar nota "Prefiro Postgres com RLS em vez de checagem na aplicação" → conversa nova "como proteger dados por usuário?" → passo "Consultou 1 nota do caderno" + a resposta menciona a preferência.
- [ ] Pergunta sem relação ("que horas são em Lisboa") não injeta nada.
- [ ] Switch desligado → nunca injeta.
- [ ] Prompt caching continua batendo no prefixo (conferir `cacheReadInputTokens` > 0 no 2º turno via log do `usage`).
- [ ] Recarregar mantém o passo (a parte `data-*` é persistida pela R4-001).

## Riscos
- Limiar muito baixo injeta ruído. **Mitigação:** começar alto (0,55), máximo 3 e passo visível; o usuário vê e desliga se incomodar.

## Notas da implementação (2026-10-16)
- **Desvio 1, onde as notas entram:** na última mensagem do usuário (bloco `<user_notes>` antes do texto), não no `system`. A ordem do prompt na Anthropic é ferramentas → system → mensagens; mudar o `system` a cada turno invalidaria o cache do histórico inteiro. Conferido: no 2º turno, `cacheReadTokens` = 3.893.
- **Desvio 2, limiar:** cosseno puro (voyage-3-lite) não separa em textos curtos. Exemplos com a nota "Prefiro Postgres com RLS…": "que horas são em Lisboa agora?" = 0,42; "como proteger dados por usuário? Responda em 3 frases." = 0,35. Com 0,55 nada passava. Solução em duas etapas (`lib/notes/context.ts`): cosseno ≥ 0,2 pré-seleciona 8 candidatas; o **rerank da Voyage** (`rerank-2.5-lite`, mesma chave, ~250 ms) decide, com relevância ≥ **0,38**. Se o rerank falhar, só passa nota com cosseno ≥ 0,6.
- Calibração (rerank-2.5-lite, 17 perguntas × 3 notas: RLS, Postgres 18, Transformer): relevantes entre 0,39 e 0,85 (ex.: "como proteger dados por usuário?" 0,44; "devo validar permissões no backend ou no banco?" 0,44; "Quantas cabeças de atenção…" 0,85). Irrelevantes até 0,35 (ex.: "que horas são em Lisboa" 0,31; "receita de bolo" 0,28; "notícias de IA" × Transformer 0,35). Ficou de fora, aceitável: "qual a melhor forma de fazer autorização em uma API?" 0,37.
- A busca roda em paralelo com `buildContext` e o carregamento do MCP; o `message.sent` agora é gravado depois dela, com `notes_used`.
- Stream: `createUIMessageStream` com `originalMessages` + `generateId` (mesmo id da R4-001); o `onEnd` externo grava a resposta com a parte `data-notes-used` (também no cancelamento: o SDK chama `onEnd` no `cancel`). Título, uso no metadata e indicador de contexto conferidos.
- UI: `components/chat/notes-used.tsx`, passo "Consultou N notas do caderno" no estilo da trilha, abre a lista com link pro Caderno. Não aparece no relatório público (as notas são privadas). "Pensando…" continua visível enquanto só a parte de notas chegou.
- Configurações: seção "Caderno" com "Usar o caderno como contexto" (migração 0006 aplicada pelo pooler: o host do `DIRECT_URL` só tem IPv6 e não resolveu daqui).
- Validado: nota RLS → conversa nova "como proteger dados por usuário? Responda em 3 frases." → passo + resposta começa com "Das suas notas, você prefere…"; 2º turno "que horas são em Lisboa" sem passo; recarregar mantém; switch desligado não injeta; switch salvo pela UI persiste; axe sem violações (conversa e Configurações). Dados de teste apagados.
