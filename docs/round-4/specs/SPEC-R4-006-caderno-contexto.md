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
