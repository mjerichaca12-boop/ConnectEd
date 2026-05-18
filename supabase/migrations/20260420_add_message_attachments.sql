alter table if exists public.messages
  add column if not exists file_url text,
  add column if not exists file_name text,
  add column if not exists file_type text,
  add column if not exists file_size bigint;

alter table if exists public.messages
  alter column message_text drop not null;

alter table if exists public.messages
  drop constraint if exists messages_content_required;

alter table if exists public.messages
  add constraint messages_content_required
  check (
    nullif(trim(coalesce(message_text, '')), '') is not null
    or nullif(trim(coalesce(file_url, '')), '') is not null
  );

insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', true)
on conflict (id) do nothing;

update storage.buckets
set public = true
where id = 'message-attachments';

drop policy if exists message_attachments_storage_select_public on storage.objects;
create policy message_attachments_storage_select_public
on storage.objects
for select
to public
using (bucket_id = 'message-attachments');

drop policy if exists message_attachments_storage_insert_public on storage.objects;
create policy message_attachments_storage_insert_public
on storage.objects
for insert
to public
with check (bucket_id = 'message-attachments');

drop policy if exists message_attachments_storage_update_public on storage.objects;
create policy message_attachments_storage_update_public
on storage.objects
for update
to public
using (bucket_id = 'message-attachments')
with check (bucket_id = 'message-attachments');

drop policy if exists message_attachments_storage_delete_public on storage.objects;
create policy message_attachments_storage_delete_public
on storage.objects
for delete
to public
using (bucket_id = 'message-attachments');
