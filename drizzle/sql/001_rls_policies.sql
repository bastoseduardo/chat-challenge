-- Row Level Security — rodar DEPOIS da migration do Drizzle.
-- Supabase SQL Editor > paste > run

alter table public.profiles          enable row level security;
alter table public.user_settings     enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.attachments       enable row level security;
alter table public.tool_invocations  enable row level security;
alter table public.shares            enable row level security;
alter table public.usage_events      enable row level security;
alter table public.audit_events      enable row level security;
alter table public.user_notes        enable row level security;

-- profiles: owner read/update
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- user_settings
drop policy if exists "settings_crud_own" on public.user_settings;
create policy "settings_crud_own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- conversations
drop policy if exists "conversations_crud_own" on public.conversations;
create policy "conversations_crud_own" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- messages: via conversation ownership
drop policy if exists "messages_select_via_conv" on public.messages;
create policy "messages_select_via_conv" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_via_conv" on public.messages;
create policy "messages_insert_via_conv" on public.messages
  for insert with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- attachments
drop policy if exists "attachments_select_own" on public.attachments;
create policy "attachments_select_own" on public.attachments
  for select using (auth.uid() = user_id);

drop policy if exists "attachments_insert_own" on public.attachments;
create policy "attachments_insert_own" on public.attachments
  for insert with check (auth.uid() = user_id);

drop policy if exists "attachments_delete_own" on public.attachments;
create policy "attachments_delete_own" on public.attachments
  for delete using (auth.uid() = user_id);

-- tool_invocations: via message -> conversation ownership
drop policy if exists "tool_inv_select_via_conv" on public.tool_invocations;
create policy "tool_inv_select_via_conv" on public.tool_invocations
  for select using (
    exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = tool_invocations.message_id and c.user_id = auth.uid()
    )
  );

-- shares
drop policy if exists "shares_crud_own" on public.shares;
create policy "shares_crud_own" on public.shares
  for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- usage_events: owner read-only (writes via service role)
drop policy if exists "usage_select_own" on public.usage_events;
create policy "usage_select_own" on public.usage_events
  for select using (auth.uid() = user_id);

-- audit_events: user vê os próprios; admin via API server (service role)
drop policy if exists "audit_select_own" on public.audit_events;
create policy "audit_select_own" on public.audit_events
  for select using (auth.uid() = user_id);

-- user_notes
drop policy if exists "notes_crud_own" on public.user_notes;
create policy "notes_crud_own" on public.user_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
