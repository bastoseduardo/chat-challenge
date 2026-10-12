# SPEC-006 — Share conversation

**User stories:** US-021, US-022, US-023, US-024
**Dependências:** SPEC-001, SPEC-002
**Estimativa:** ~2h

## Objetivo
Dono gera link público read-only de uma conversa. Visitante vê histórico (incluindo anexos) sem login. Dono pode revogar. View é live.

## Acceptance criteria

- [ ] AC-1 Botão "Compartilhar" na conversa gera token (nanoid 24 chars) e insere em `shares`.
- [ ] AC-2 Modal com link copiável e botão "Revogar".
- [ ] AC-3 Rota `/share/[token]` serve a conversa sem exigir login.
- [ ] AC-4 Visitante vê: título, mensagens (user + assistant), anexos (via signed URL 1h), tool calls (nome e resumo).
- [ ] AC-5 Mensagens novas enviadas pelo dono aparecem na view ao refresh (live).
- [ ] AC-6 Revogação: `shares.revoked_at = now()` → `/share/[token]` responde 404.
- [ ] AC-7 Token é cryptographically random (`nanoid`).
- [ ] AC-8 Audit: `conversation.shared` / `conversation.unshared`.
- [ ] AC-9 View read-only: sem composer, sem edição, sem botões de admin.
- [ ] AC-10 Head meta tags OG preenchidos (title + description).

## Modelo de dados
`shares` (ver arquitetura).

## Função Postgres (SECURITY DEFINER)

```sql
create or replace function public.get_shared_conversation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share shares%rowtype;
  v_conv conversations%rowtype;
  v_msgs jsonb;
begin
  select * into v_share from shares
   where token = p_token and revoked_at is null;
  if not found then
    return null;
  end if;

  select * into v_conv from conversations
   where id = v_share.conversation_id and deleted_at is null;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(m order by m.created_at), '[]'::jsonb) into v_msgs
    from (
      select id, role, content, is_summary, created_at
      from messages
      where conversation_id = v_conv.id
    ) m;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conv.id,
      'title', v_conv.title,
      'created_at', v_conv.created_at,
      'compaction_count', v_conv.compaction_count
    ),
    'messages', v_msgs
  );
end;
$$;
```

Anexos: endpoint auxiliar `/api/share/[token]/attachment/[id]` valida token+msg_id → signed URL.

## Endpoints

| Method | Path | Função |
|---|---|---|
| POST | `/api/conversations/[id]/share` | cria token |
| DELETE | `/api/conversations/[id]/share` | revoga |
| GET | `/share/[token]` | page (SSR, chama a função) |
| GET | `/api/share/[token]/attachment/[aid]` | signed URL de anexo |

## Componentes
- `<ShareDialog/>` — modal com link + copy + revoke
- `<SharePage/>` — view read-only (reusa `<Message/>`)

## Tasks

1. [ ] Migration: `shares` + função `get_shared_conversation`
2. [ ] API POST/DELETE share
3. [ ] UI ShareDialog
4. [ ] Página `/share/[token]` (RSC)
5. [ ] API resolve attachment por token
6. [ ] OG meta tags
7. [ ] Audit hooks
8. [ ] Teste em aba anônima

## Riscos
- **Vazamento de anexos de outras conversas** → endpoint confere `attachment.message_id` pertence à conv do token.
- **Token enumeration** → nanoid 24 chars (144 bits de entropia).

## #PATH_DECISION
RSC + função PG `security definer`: 1 chamada, dados safe, zero RLS complexo.
