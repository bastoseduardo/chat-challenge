# SPEC-R4-004: Caderno, dados e API

**Esforço:** ~1 dia · **Prioridade:** P1 · **Depende de:** — · **Bloqueia:** 005, 006
**Pode rodar junto com:** 001, 002, 009, 011 · **Tasks:** R4041–R4047

## Objetivo
Transformar `user_notes` (hoje só `content`, usada pelo MCP) na base do Caderno: notas com origem, busca por significado e API REST.

## Contexto
- `lib/db/schema.ts`: `userNotes { id, userId, content, createdAt }`.
- `lib/db/queries/notes.ts`: `saveNote`, `listNotes`, `searchNotes` (ilike).
- `lib/mcp/user-notes-handler.ts`: ferramentas MCP `save_note`, `list_notes`, `search_notes`.
- Embeddings: `lib/ai/embeddings.ts` (`embedDocument`, `embedQuery`, Voyage dim 512); padrão de background em `lib/db/queries/search.ts` (`embedAndStoreMessage` via `after()`).
- RLS: `drizzle/sql/001_rls_policies.sql` já cobre `user_notes` por `user_id` (conferir).

## Escopo

### Schema (aditivo)
```sql
alter table user_notes
  add column title text,
  add column quote text,
  add column source_url text,
  add column source_title text,
  add column source_page int,
  add column conversation_id uuid references conversations(id) on delete set null,
  add column message_id uuid references messages(id) on delete set null,
  add column embedding vector(512),
  add column updated_at timestamptz not null default now(),
  add column deleted_at timestamptz;
create index user_notes_embedding_idx on user_notes using hnsw (embedding vector_cosine_ops);
create index user_notes_user_created_idx on user_notes (user_id, created_at desc);
```
Editar `lib/db/schema.ts` agora; **gerar a migração só no merge** (tasks.md, convenção 4).

### Queries (`lib/db/queries/notes.ts`)
`createNote`, `listNotes({ userId, conversationId?, limit, cursor })`, `getNote`, `updateNote`, `softDeleteNote`, `restoreNote`, `searchNotes({ userId, q, limit })`: texto (ilike em `content`/`quote`/`title`) unido a vetor (`embedQuery` + cosine) com deduplicação, ordenado por relevância. `similarNotes({ userId, text, limit, minSimilarity })` exportada para a R4-006.

### API
| Rota | Corpo / params | Resposta |
|---|---|---|
| `GET /api/notes` | `?conversationId&cursor&limit` | `{ notes, nextCursor }` |
| `POST /api/notes` | `{ content, title?, quote?, source?: { url?, title?, page? }, conversationId?, messageId? }` (zod) | `{ note }` |
| `PATCH /api/notes/[id]` | `{ content?, title?, restore?: true }` | `{ ok }` |
| `DELETE /api/notes/[id]` | — | `{ ok }` (soft) |
| `GET /api/notes/search` | `?q` | `{ notes }` |

Todas autenticadas, filtrando por `user.id`. Rate limit igual às outras rotas de escrita.

### MCP e audit
- `save_note`/`list_notes`/`search_notes` passam a usar as queries novas (notas do chat aparecem no Caderno com `conversation_id` quando disponível).
- `AuditEventType` ganha `note.created`, `note.deleted`.
- Embedding gerado em `after()` ao criar e ao editar `content`.

## Arquivos
- Modificar: `lib/db/schema.ts`, `lib/db/queries/notes.ts`, `lib/mcp/user-notes-handler.ts`, `lib/audit/log.ts`
- Criar: `app/api/notes/route.ts`, `app/api/notes/[id]/route.ts`, `app/api/notes/search/route.ts`, `lib/notes/schema.ts` (zod), `tests/unit/notes-schema.test.ts`

## Acceptance criteria
- [ ] Criar, listar, buscar ("RLS" encontra nota que diz "row level security"), editar, apagar e restaurar pela API (curl com cookie do dev-login).
- [ ] `save_note` pelo chat cria nota visível em `GET /api/notes`.
- [ ] Notas antigas aparecem normalmente (colunas novas nulas).
- [ ] Testes de validação do payload.
- [ ] Usuário A não lê nota de B (testar com id de outra conta: 404).

## Riscos
- Migração em banco compartilhado com produção: só `add column`/`create index`, conforme convenção 3.
