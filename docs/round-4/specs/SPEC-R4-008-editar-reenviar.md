# SPEC-R4-008: Editar e reenviar

**Esforço:** ~1 dia · **Prioridade:** P2 · **Depende de:** 001 · **Bloqueia:** —
**Pode rodar junto com:** 006, 010 (mergear **depois** da 006 e da 007) · **Tasks:** R4081–R4084

## Objetivo
Corrigir uma pergunta sem começar uma conversa nova: editar a mensagem do usuário, apagar o que veio depois e gerar de novo.

## Contexto
- `useChat` (AI SDK 7) em `components/chat/chat-view.tsx`; `sendMessage`, `setMessages`, `regenerate`.
- Compactação: mensagens com `is_summary = true`; `buildContext` começa do último resumo.
- Ids iguais entre cliente e banco: R4-001.

## Escopo
1. **Schema (aditivo):** `messages.deleted_at timestamptz`.
2. **Filtros:** `deleted_at is null` em `buildContext`, `listMessagesWithAttachments`, `listMessages`, export, busca semântica (`semantic_search_messages`), e na função de share (estender a v2 da R4-007 em `drizzle/sql/007_share_function_v3.sql`).
3. **API:** `POST /api/conversations/[id]/truncate { fromMessageId }`: soft delete de `fromMessageId` e de todas as posteriores. **Bloqueia com 409** se existir resumo de compactação criado depois de `fromMessageId` ("Essa parte da conversa já foi resumida e não pode ser editada"). Audit `message.edited`.
4. **UI:**
   - Lápis (aparece em hover/foco; sempre visível em `pointer-coarse`) nas mensagens do usuário.
   - Edição inline com `textarea` (mesmo autosize do composer), "Cancelar" e "Enviar".
   - Ao enviar: `truncate` no servidor → `setMessages(mensagens até antes da editada)` → `sendMessage` com o novo texto. Anexos da mensagem original não são reaproveitados (avisar no texto de ajuda).
   - Enquanto gera, a edição fica desabilitada.

## Arquivos
- Modificar: `lib/db/schema.ts`, `lib/ai/history.ts`, `lib/db/queries/messages-with-attachments.ts`, `lib/db/queries/conversations.ts`, `lib/db/queries/search.ts` (ou a função SQL), `app/api/conversations/[id]/export/route.ts`, `components/chat/chat-view.tsx`, `components/chat/message-bubble.tsx` (plugar o componente)
- Criar: `app/api/conversations/[id]/truncate/route.ts`, `components/chat/edit-user-message.tsx`, `drizzle/sql/007_share_function_v3.sql`, `tests/unit/truncate-rule.test.ts`

## Acceptance criteria
- [ ] Editar a 2ª pergunta de uma conversa com 3 trocas: some tudo depois dela, a nova resposta chega, recarregar confirma.
- [ ] Mensagens apagadas não aparecem no export, no share, na busca nem no contexto do modelo.
- [ ] Tentar editar antes de um resumo de compactação mostra a mensagem de bloqueio.
- [ ] Teste unitário da regra de bloqueio.
