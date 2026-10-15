# SPEC-R4-001: Salvar a resposta completa + contrato de fontes

**Esforço:** ~0,5 dia · **Prioridade:** P0 · **Depende de:** — · **Bloqueia:** 003, 005, 006, 007, 008, 012
**Pode rodar junto com:** 002, 004, 009, 011 · **Tasks:** R4001–R4007

## Objetivo
Gravar no banco a resposta do assistente exatamente como o cliente a recebeu (texto, ferramentas e fontes), e entregar o contrato `lib/sources` que as outras specs usam.

## Contexto
- `app/api/chat/route.ts`, `onFinish` do `streamText`: grava `content: [{ type: "text", text }]`. Ferramentas vão pra `tool_invocations`; nada de fontes.
- `lib/db/queries/messages-with-attachments.ts` remonta as partes de ferramenta a partir de `tool_invocations` (`dynamic-tool`).
- `toUIMessageStreamResponse` hoje só passa `messageMetadata` (uso de tokens).
- O id da mensagem do assistente no cliente é gerado pelo AI SDK e difere do `messages.id`.

## Escopo
1. `sendSources: true` e `generateMessageId: () => crypto.randomUUID()` no `toUIMessageStreamResponse`.
2. Persistência no `onEnd({ responseMessage, isAborted })` do `toUIMessageStreamResponse`:
   - `insert` em `messages` com `id = responseMessage.id`, `role: "assistant"`, `content = responseMessage.parts` (com saídas de ferramenta truncadas, item 4), `inputTokens`, `outputTokens`, `model`.
   - Se `isAborted`, gravar mesmo assim o que chegou (hoje uma resposta interrompida se perde).
3. O `onFinish` do `streamText` continua responsável por totals da conversa, `recordUsage`, `persistToolInvocations`, audit, embedding e `scheduleCompaction`. Ele precisa do `messageId` gravado: coordenar as duas callbacks (o insert acontece num lugar só; o outro aguarda uma `Promise` compartilhada com o id). **Não duplicar o insert.**
4. Truncar `output` de partes de ferramenta acima de 8 KB ao salvar (`{ truncated: true, preview: "..." }`). O texto citado fica preservado nas partes `source-*`.
5. `listMessagesWithAttachments`: se `content` tem partes além de `text` (formato novo), devolver como está (reassinando URLs de anexos como hoje); senão, manter a remontagem atual. Sem migração de dados.
6. `buildContext` não muda (manda só o texto ao modelo).
7. `lib/sources/types.ts` e `lib/sources/extract.ts` conforme SPEC-R4-000 §2.

## Fora de escopo
Renderizar as fontes (R4-003). Mudar ferramentas (R4-003).

## Arquivos
- Modificar: `app/api/chat/route.ts`, `lib/db/queries/messages-with-attachments.ts`
- Criar: `lib/sources/types.ts`, `lib/sources/extract.ts`, `tests/unit/sources.test.ts`

## Acceptance criteria
- [ ] Uma resposta com ferramenta, recarregada, renderiza as mesmas partes (mesma trilha, mesmos estados) que no stream.
- [ ] `messages.id` da resposta = `message.id` no cliente logo após o stream (verificar via `document.getElementById("msg-<id>")` antes e depois do reload).
- [ ] Interromper (Esc) no meio da resposta e recarregar mostra o texto parcial.
- [ ] Conversas antigas continuam abrindo igual a antes.
- [ ] `extractSources` com ≥5 testes: web, documento com páginas, duplicadas por URL, mensagem sem fontes, ordem por primeira aparição.
- [ ] Uso de tokens, audit e compactação continuam funcionando (conferir em `/usage` e `/admin/audit`).

## Riscos
- Duas callbacks com ordem não garantida. **Mitigação:** promessa compartilhada criada antes do `streamText`; quem tiver os dados que faltam espera.
- Tamanho do `content`: truncamento do item 4.

## #PATH_DECISION
Salvar as `parts` da `UIMessage` (formato que a UI já entende) em vez de normalizar fontes em tabela própria: zero mapeamento na leitura, e o compartilhamento público (que lê `messages.content` pela função SQL) passa a receber as fontes de graça.
