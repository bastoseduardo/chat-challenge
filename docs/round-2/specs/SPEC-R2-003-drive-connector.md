# SPEC-R2-003 — Google Drive connector

**Esforço:** ~2h · **Prioridade:** P1 (2º diferencial)

## Objetivo
Tool `drive_search_files` + `drive_read_file` que acessa o Drive do usuário logado, usando o `provider_token` do Google OAuth que já vem no fluxo Supabase.

## Pré-requisitos
- Google OAuth no Supabase precisa requisitar o scope `drive.readonly`.
- `supabase.auth.signInWithOAuth` precisa pedir `scopes: 'https://www.googleapis.com/auth/drive.readonly'`.
- O `provider_token` vem na sessão e precisa ser armazenado (Supabase persiste no `auth.sessions` → acessível via SDK).

## Acceptance criteria

- [ ] Login Google agora pede escopo `drive.readonly` (usuários novos verão o consent)
- [ ] Toggle "Drive connector" em `/settings` (adiciona ao `enabled_tools`)
- [ ] Tool `drive_search_files({query})` lista arquivos do Drive do user
- [ ] Tool `drive_read_file({fileId})` retorna o conteúdo em texto (Google Docs/Sheets como texto, binários rejeitados com erro amigável)
- [ ] Erro de token expirado retorna mensagem clara ("reconecte sua conta Google")
- [ ] Audit `tool.invoked` com `tool_source=connector`

## Modelo de dados
Nenhuma tabela nova. Token lido da sessão Supabase (`session.provider_token`).

## Fluxo

```
User chat → modelo chama drive_search_files({query: "orçamento"})
  │
  ├─ Server lê provider_token da sessão
  ├─ GET https://www.googleapis.com/drive/v3/files?q=name contains 'orçamento'
  ├─ Retorna lista [{id, name, mimeType}]
  │
User → "lê o arquivo X"
  │
  ├─ Modelo chama drive_read_file({fileId: "..."})
  ├─ Se Google Doc → GET /files/{id}/export?mimeType=text/plain
  ├─ Se Sheet → GET /files/{id}/export?mimeType=text/csv
  ├─ Senão → erro "binários não suportados no MVP"
```

## Tasks

1. [ ] Atualizar `login/page.tsx`: `signInWithOAuth({ provider: "google", options: { scopes: "https://www.googleapis.com/auth/drive.readonly", ... } })`
2. [ ] `lib/ai/tools/drive-search.ts` — tool com Zod schema
3. [ ] `lib/ai/tools/drive-read.ts`
4. [ ] Expor em `lib/ai/tools/index.ts` como `BuiltinToolName = ... | "drive_search_files" | "drive_read_file"`
5. [ ] Adicionar switches em `/settings` (default OFF — usuário precisa aprovar)
6. [ ] Fetch do provider_token no `/api/chat`:
   ```ts
   const { data: { session } } = await supabase.auth.getSession()
   const driveToken = session?.provider_token
   ```
7. [ ] Passar o token pras tools via contexto (closure ou request-scoped)
8. [ ] Tratamento de erro 401 → mensagem amigável
9. [ ] Audit event

## Riscos

| Risco | Mitigação |
|---|---|
| User precisa relogar pra pegar novo scope | Documentado no README |
| Provider token expira em 1h | Supabase renova via refresh — se falhar, pedir relogin |
| Google Doc muito grande | Truncar em 20k chars |

## #PATH_DECISION
Mantém como tool "builtin" (não MCP) por simplicidade. Pra ser MCP de verdade teria que ser um server separado — overkill. A integração com `provider_token` do Supabase evita OAuth flow duplicado.
