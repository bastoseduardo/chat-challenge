# SPEC-R4-012: Espaços de pesquisa (estica)

**Esforço:** ~3 dias · **Prioridade:** Estica (só depois de 001–010) · **Depende de:** 001, 003 · **Tasks:** R4121–R4125

## Objetivo
Juntar fontes uma vez (PDFs, links) e fazer várias conversas sobre elas, sempre com citações. Ex.: "Due diligence da empresa X" com 8 PDFs.

## Decisão de arquitetura
Para o volume de portfólio, **sem pipeline próprio de chunking/RAG**: as fontes do projeto entram em **toda** conversa do projeto como documentos com citações (SPEC-R4-003), no início das mensagens e com **prompt caching** (`providerOptions.anthropic.cacheControl` no último documento), já que são estáveis. Limites: 10 documentos ou ~300 páginas por projeto (mostrar o uso). Revisitar com RAG se passar disso.

## Escopo
1. **Schema (aditivo):** `projects (id, user_id, name, description, created_at, updated_at, deleted_at)`, `project_sources (id, project_id, kind: 'pdf'|'url', storage_path, url, title, pages, created_at)`, `conversations.project_id uuid null`. RLS por `user_id` (novo `drizzle/sql/008_projects_rls.sql`).
2. **API:** CRUD de projetos; upload de fontes reaproveitando `/api/attachments/upload` (bucket existente, prefixo `projects/<id>/`); URLs lidas uma vez e guardadas como texto.
3. **Contexto:** `buildContext` injeta as fontes do projeto quando `conversation.project_id` existe.
4. **Interface:** sidebar com seção "Projetos" (cada projeto agrupa as suas conversas); página do projeto com fontes (adicionar e remover) e "Nova conversa neste projeto".
5. Citações das fontes do projeto usam o mesmo `SourceCard`.

## Acceptance criteria
- [ ] Projeto com 3 PDFs; 2 conversas diferentes citam páginas dos PDFs sem reanexar.
- [ ] 2ª pergunta no mesmo projeto mostra `cacheReadInputTokens > 0`.
- [ ] Remover uma fonte tira ela das próximas respostas.
