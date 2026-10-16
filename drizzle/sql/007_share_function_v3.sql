-- SPEC-R4-008: get_shared_conversation v3. Igual à v2 (006_share_function_v2.sql),
-- mais o filtro de mensagens apagadas (messages.deleted_at, migração 0007).
-- Aplicar depois da 0007: npx tsx scripts/apply-sql.ts drizzle/sql/007_share_function_v3.sql

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
