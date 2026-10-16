-- SPEC-R4-007: get_shared_conversation v2. Mesma assinatura e grants da v1
-- (003_share_function.sql); só ACRESCENTA o objeto "share" (resumo e data) ao
-- JSON, então o código antigo continua funcionando.
-- Aplicar com: npx tsx scripts/apply-sql.ts drizzle/sql/006_share_function_v2.sql

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
