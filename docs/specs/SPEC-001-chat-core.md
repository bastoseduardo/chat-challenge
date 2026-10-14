# SPEC-001 — Chat Core

**User stories:** US-001 a US-006
**Dependências:** nenhuma (fundação)
**Estimativa:** ~6h

> **Nota:** snapshot da fase de Planning. Decisões tomadas durante a implementação
> estão em [`../03-decisions.md`](../03-decisions.md) a partir de §3.11.

## Objetivo
Chat multi-conversa com login Google, streaming, histórico persistido, sidebar com conversas, criar/renomear/deletar.

## Acceptance criteria

- [ ] AC-1 Login Google funciona (Supabase Auth).
- [ ] AC-2 Rotas protegidas redirecionam para `/login` quando sem sessão.
- [ ] AC-3 Nova conversa é criada ao clicar "New chat".
- [ ] AC-4 Mensagens do usuário aparecem imediatamente (optimistic UI).
- [ ] AC-5 Resposta do assistente chega em streaming (SSE).
- [ ] AC-6 Histórico persiste em `messages` e reaparece após refresh.
- [ ] AC-7 Sidebar lista conversas ordenadas por `updated_at desc`.
- [ ] AC-8 Deletar conversa é soft (`deleted_at`) e some da UI.
- [ ] AC-9 Renomear conversa funciona inline.
- [ ] AC-10 Título da conversa é auto-gerado após 1ª resposta (chamada LLM barata).

## Modelo de dados
`profiles`, `conversations`, `messages` (ver [02-architecture.md §3](../02-architecture.md)).

## Endpoints

| Method | Path | Função |
|---|---|---|
| GET | `/api/conversations` | lista do user |
| POST | `/api/conversations` | cria |
| GET | `/api/conversations/[id]` | detalhes + msgs |
| PATCH | `/api/conversations/[id]` | rename |
| DELETE | `/api/conversations/[id]` | soft delete |
| POST | `/api/chat` | stream (SPEC-001 core) |
| POST | `/api/conversations/[id]/title` | auto-gera título |

## Componentes UI
- `<Sidebar/>` — lista conversas, botão "New"
- `<ChatView/>` — thread + composer
- `<Message/>` — markdown + highlight
- `<Composer/>` — textarea + attach + submit
- `<ConversationItem/>` — row com rename/delete menu

## Tasks

1. [ ] Setup Next.js 15 + TS + Tailwind + shadcn
2. [ ] Supabase project + env vars
3. [ ] Drizzle schema + 1ª migration (profiles, conversations, messages)
4. [ ] Supabase SSR middleware + helper `getUser()`
5. [ ] Trigger auto-create `profiles` row on signup
6. [ ] Rota `/login` com Google OAuth button
7. [ ] Rota `/api/conversations` CRUD
8. [ ] Rota `/api/chat` com AI SDK `streamText` (sem tools ainda)
9. [ ] Página `/c/[id]` — chat UI
10. [ ] Sidebar + conversation list
11. [ ] Auto title generator
12. [ ] Soft delete + rename
13. [ ] Smoke test manual

## Riscos
- **RLS mal configurada expõe conversas** → testar com 2 users na primeira iteração.
- **Streaming quebrado em Vercel** → confirmar `export const runtime = 'nodejs'` nas rotas AI SDK.

## #PATH_DECISION
Server-sent events via AI SDK `toDataStreamResponse()`. Simples e nativo.
