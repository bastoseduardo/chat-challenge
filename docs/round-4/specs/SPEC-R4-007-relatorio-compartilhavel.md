# SPEC-R4-007: Compartilhar como relatório

**Esforço:** ~1,5 dia · **Prioridade:** P1 · **Depende de:** 001 (fontes persistidas) · **Bloqueia:** —
**Pode rodar junto com:** 003, 005 · **Tasks:** R4071–R4077

## Objetivo
O link compartilhado deixa de ser "uma conversa" e vira um documento que dá pra mandar pra alguém: resumo, conversa com fontes e PDF.

## Contexto
- Página pública: `app/share/[token]/page.tsx` (Round 3). Dados: `lib/db/queries/shared-conversation.ts` → RPC `get_shared_conversation` (`drizzle/sql/003_share_function.sql`, `SECURITY DEFINER`, devolve conversa + mensagens).
- Diálogo de compartilhar: `components/chat/share-dialog.tsx`; API `app/api/conversations/[id]/share/route.ts` (GET/POST/DELETE).
- Contrato de fontes: SPEC-R4-000 §2. Os componentes de citação (`SourcesList`) são da R4-003; até ela mergear, a seção "Fontes consultadas" usa uma lista simples própria com `extractSources` e é trocada depois.

## Escopo
1. **Schema (aditivo):** `shares.summary text`, `shares.summary_generated_at timestamptz`.
2. **Resumo:** no `POST /share` (e em `POST /share?regenerate=1`), gerar com `generateText` (`DEFAULT_MODEL`): 3 a 5 frases + até 4 conclusões em lista, em português, sem inventar além da conversa. Registrar uso com `recordUsage({ eventKind: "tool_llm" })`. Falha na geração não impede o compartilhamento (resumo fica nulo).
3. **Função SQL:** `drizzle/sql/006_share_function_v2.sql` com `create or replace function get_shared_conversation` devolvendo também `share.summary` e `share.created_at`. Mesma assinatura e mesmos grants. (A R4-008 estende a mesma função depois pra filtrar `deleted_at`: combinar no merge.)
4. **Página de relatório** (`/share/[token]`):
   - cabeçalho: título, "Pesquisado com Seshat em <data>", "Somente leitura", botões "Baixar PDF" e "Entrar para conversar";
   - **Resumo** (quando existir) num bloco destacado;
   - conversa (componentes reais, somente leitura);
   - **Fontes consultadas**: todas as `Source` da conversa agregadas, numeradas, com link.
5. **PDF:** `@media print` em `app/globals.css` (esconder botões e badges, cores claras forçadas, `break-inside: avoid` nas mensagens, links com URL impressa nas fontes). Botão chama `window.print()`. *Lembrar: `globals.css` exige reiniciar o dev.*
6. **Open Graph:** `generateMetadata` com `title` e `description` = primeira frase do resumo.
7. **Diálogo de compartilhar:** mostra o resumo gerado e "Gerar resumo de novo".

## Arquivos
- Modificar: `lib/db/schema.ts`, `app/api/conversations/[id]/share/route.ts`, `lib/db/queries/shared-conversation.ts`, `app/share/[token]/page.tsx`, `components/chat/share-dialog.tsx`, `app/globals.css`
- Criar: `drizzle/sql/006_share_function_v2.sql`, `lib/ai/share-summary.ts`

## Acceptance criteria
- [ ] Compartilhar uma conversa com busca gera resumo em < 10 s; o diálogo mostra o resumo.
- [ ] Link deslogado: resumo, conversa, fontes; desktop e 390 px.
- [ ] "Baixar PDF" gera documento legível em A4 (conferir com `page.pdf()` do Playwright).
- [ ] Colar o link num validador de OG mostra título e resumo.
- [ ] Revogar continua funcionando; links antigos sem resumo continuam abrindo.
- [ ] axe sem violações na página pública.
- [ ] Limpeza: shares e conversas de teste revogados e apagados.

## Riscos
- `create or replace function` roda no banco de produção. **Mitigação:** a v2 só **adiciona** campos ao JSON; o código antigo ignora campos extras.
