# SPEC-R4-005: Caderno, interface

**Esforço:** ~1 dia · **Prioridade:** P1 · **Depende de:** 004 (API), 001 (ids de mensagem e fontes) · **Bloqueia:** 010
**Pode rodar junto com:** 003, 007 · **Tasks:** R4051–R4058

## Objetivo
O usuário guarda o que importa com 1 clique e encontra depois, sabendo de onde veio.

## Contexto
- API: SPEC-R4-004. Contrato de fontes e ids: SPEC-R4-000.
- Shell: `app/(app)/layout.tsx`, sidebar `components/chat/sidebar.tsx`, cabeçalho `components/app-header.tsx`.
- Padrões a reaproveitar: mutações otimistas com "Desfazer" (`lib/conversations/store.ts`), paleta (`components/search/command-palette.tsx`).

## Escopo

### Página `/caderno`
1. Rota `app/(app)/caderno/page.tsx` (+ `loading.tsx`), título de aba "Caderno".
2. Lista em ordem cronológica, cada nota com: título (ou primeira linha), `quote` em destaque (bloco com borda `--tool` à esquerda, serif), conteúdo, origem ("de: <título da conversa>" com link `/c/<id>#msg-<messageId>`; "fonte: <sourceLabel>" com link) e data.
3. Busca no topo (debounce 250 ms, `GET /api/notes/search`), filtro "Desta conversa" quando vier de `?conversationId=`.
4. Editar inline (título e conteúdo) e apagar com toast "Nota apagada · Desfazer".
5. Estado vazio: "Guarde trechos das respostas selecionando o texto. Eles aparecem aqui, com a fonte."
6. Hooks em `lib/notes/store.ts` (React Query, mesmo padrão de `lib/conversations/store.ts`).

### Guardar a partir da conversa
7. `components/chat/selection-to-save.tsx`: envolve o conteúdo do `AssistantMessage`; ao selecionar texto dentro dele (mouseup/touchend + `selectionchange`), mostra um botão flutuante "Guardar no caderno" perto da seleção. Teclado: atalho `Ctrl+Shift+S` com seleção ativa.
   - Envia `quote` = texto selecionado, `messageId`, `conversationId` e a fonte da marcação mais próxima, se houver (via `citationsByPart`, quando a R4-003 estiver mergeada; antes disso, sem fonte).
8. Ação "Guardar resposta" junto de Copiar/Gerar de novo (texto inteiro, sem `quote`).
9. Toast "Guardado no caderno" com ação "Abrir" (`/caderno`).

### Navegação
10. Item "Caderno" na sidebar (ícone `NotebookPen`, entre o grupo de conversas e "Uso").
11. Paleta Ctrl+K: grupo "No caderno" (usa `GET /api/notes/search`).

## Integração com a R4-003 (evitar conflito)
`message-bubble.tsx` recebe só: envolver os blocos com `<SelectionToSave>` e um `ActionButton` a mais. Todo o resto em arquivos novos.

## Arquivos
- Criar: `app/(app)/caderno/page.tsx`, `app/(app)/caderno/loading.tsx`, `components/notes/notes-list.tsx`, `components/notes/note-item.tsx`, `components/chat/selection-to-save.tsx`, `lib/notes/store.ts`
- Modificar (pouco): `components/chat/message-bubble.tsx`, `components/chat/sidebar.tsx`, `components/search/command-palette.tsx`

## Acceptance criteria
- [ ] Selecionar uma frase numa resposta → "Guardar no caderno" → toast → nota aparece em `/caderno` com link que rola até a mensagem.
- [ ] Guardar logo após o stream (sem recarregar) grava `message_id` correto (depende da R4-001).
- [ ] Busca por significado funciona na página e no Ctrl+K.
- [ ] Editar, apagar e desfazer sem recarregar a página (sem request RSC).
- [ ] Mobile: seleção por toque mostra o botão; lista legível em 390 px.
- [ ] axe sem violações em `/caderno` e na conversa com o botão visível.
- [ ] E2E opcional (`E2E_DEV_LOGIN=1`): cria nota pela API, edita, apaga, desfaz, limpa.

## Riscos
- Botão flutuante disputando com o menu nativo de seleção no mobile. **Mitigação:** no `pointer-coarse`, mostrar o botão fixo acima do composer em vez de flutuante.
