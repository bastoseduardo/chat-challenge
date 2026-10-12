-- Função pública para resolver share tokens em conversas read-only.
-- SECURITY DEFINER: roda com privilégios do owner (postgres) e expõe apenas campos seguros.

create or replace function public.get_shared_conversation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_share  public.shares%rowtype;
  v_conv   public.conversations%rowtype;
  v_msgs   jsonb;
begin
  select * into v_share
    from public.shares
   where token = p_token and revoked_at is null;

  if not found then
    return null;
  end if;

  select * into v_conv
    from public.conversations
   where id = v_share.conversation_id and deleted_at is null;

  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(m order by m.created_at), '[]'::jsonb) into v_msgs
    from (
      select
        id,
        role,
        content,
        is_summary,
        created_at
      from public.messages
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

-- Permitir chamada por qualquer um (anon + authenticated).
grant execute on function public.get_shared_conversation(text) to anon, authenticated;


-- Função auxiliar para visitante do share acessar anexo (valida que o attachment
-- pertence a uma mensagem da conversa cujo token é válido).
create or replace function public.get_shared_attachment(p_token text, p_attachment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select a.id, a.storage_path, a.mime_type, a.original_name, a.kind
    into v_row
    from public.attachments a
    join public.messages m on m.id = a.message_id
    join public.conversations c on c.id = m.conversation_id
    join public.shares s on s.conversation_id = c.id
   where s.token = p_token
     and s.revoked_at is null
     and c.deleted_at is null
     and a.id = p_attachment_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'storage_path', v_row.storage_path,
    'mime_type', v_row.mime_type,
    'original_name', v_row.original_name,
    'kind', v_row.kind
  );
end;
$$;

grant execute on function public.get_shared_attachment(text, uuid) to anon, authenticated;
