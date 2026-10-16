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

## Notas da implementação (2026-10-16)
- Migração `0007_messages_deleted_at.sql`; `drizzle/sql/007_share_function_v3.sql` (share sem apagadas) e `008_semantic_search_v2.sql` (busca sem apagadas), aplicadas. Filtro `deleted_at is null` em `buildContext`, compactação, resumo do relatório, `listMessages` (export) e `listMessagesWithAttachments`.
- `POST /api/conversations/[id]/truncate` aceita o id do banco ou o `client_message_id` (antes de recarregar, o cliente só conhece o id que ele gerou). Regra em `lib/conversations/truncate-rule.ts` (bloqueia se houver resumo criado depois da mensagem; sem isso o "apagar as seguintes" levaria o próprio resumo junto). Audit `message.edited` (também na lista do `/admin/audit`, junto com `note.*`, que faltava).
- Achado e corrigido: "Gerar de novo" reenviava a mesma pergunta (duplicada pelo `clientMessageId`) e a resposta anterior continuava no banco, então as duas voltavam ao recarregar. Agora a rota do chat apaga (soft) o que veio depois da pergunta repetida.
- Achado e corrigido (regressão da R4-005, só na `ux/round-4`): `/share/<token>` dava 500, porque o `AssistantMessage` chamava `useNoteActions` (React Query) e a página pública não tem o provider. "Guardar resposta" virou um componente à parte, só renderizado com `conversationId`.
- UI: lápis abaixo da pergunta (hover/foco; sempre visível e com 40 px no toque), edição inline com Enter/Shift+Enter/Esc; desabilitado enquanto gera.
- Validado: 3 trocas → editar a 2ª → some o resto, chega a resposta nova, recarregar confirma; o modelo lista só "2+2, 5+5"; export, relatório (200) e busca sem as apagadas; "Gerar de novo" + recarregar mantém 1 resposta; bloqueio com resumo mostra o aviso e mantém o editor; axe sem violações no modo edição. Dados de teste apagados.
