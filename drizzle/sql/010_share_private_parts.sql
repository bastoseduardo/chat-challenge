-- get_shared_conversation v4 e get_shared_attachment v2. Iguais às anteriores
-- (007_share_function_v3.sql, 003_share_function.sql), mais:
-- - as partes `data-notes-used` (notas privadas do caderno usadas como contexto,
--   SPEC-R4-006) saem do conteúdo das mensagens do relatório público;
-- - anexo de mensagem apagada (editar e reenviar, SPEC-R4-008) não é servido.
-- Aplicar com: npx tsx scripts/apply-sql.ts drizzle/sql/010_share_private_parts.sql

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
        case
          when jsonb_typeof(content) = 'array' then (
            select coalesce(jsonb_agg(p order by ord), '[]'::jsonb)
              from jsonb_array_elements(content) with ordinality as e(p, ord)
             where coalesce(p->>'type', '') <> 'data-notes-used'
          )
          else content
        end as content,
        is_summary,
        created_at
      from public.messages
      where conversation_id = v_conv.id
        and deleted_at is null
    ) m;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conv.id,
      'title', v_conv.title,
      'created_at', v_conv.created_at,
      'compaction_count', v_conv.compaction_count
    ),
    'share', jsonb_build_object(
      'summary', v_share.summary,
      'summary_generated_at', v_share.summary_generated_at,
      'created_at', v_share.created_at
    ),
    'messages', v_msgs
  );
end;
$$;

grant execute on function public.get_shared_conversation(text) to anon, authenticated;

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
     and m.deleted_at is null
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
