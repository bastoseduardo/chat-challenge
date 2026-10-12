-- Bucket privado para anexos de chat.
-- Supabase Storage > novo bucket, ou rodar este SQL no Editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-attachments',
  'chat-attachments',
  false,
  21 * 1024 * 1024, -- 21 MB (margem acima de 20 MB PDF)
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
on conflict (id) do nothing;

-- Policies: user só vê/escreve arquivos dentro do próprio prefixo {user_id}/...
drop policy if exists "chat_attachments_select_own" on storage.objects;
create policy "chat_attachments_select_own" on storage.objects
  for select using (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "chat_attachments_insert_own" on storage.objects;
create policy "chat_attachments_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "chat_attachments_delete_own" on storage.objects;
create policy "chat_attachments_delete_own" on storage.objects
  for delete using (
    bucket_id = 'chat-attachments'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
