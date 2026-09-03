-- 1. Create chat-attachments bucket and policies
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

update storage.buckets
set public = true
where id = 'chat-attachments';

drop policy if exists chat_attachments_select on storage.objects;
create policy chat_attachments_select on storage.objects
for select to public using (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_insert on storage.objects;
create policy chat_attachments_insert on storage.objects
for insert to public with check (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_update on storage.objects;
create policy chat_attachments_update on storage.objects
for update to public using (bucket_id = 'chat-attachments') with check (bucket_id = 'chat-attachments');

drop policy if exists chat_attachments_delete on storage.objects;
create policy chat_attachments_delete on storage.objects
for delete to public using (bucket_id = 'chat-attachments');


-- 2. Create announcement-images bucket and policies
insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

update storage.buckets
set public = true
where id = 'announcement-images';

drop policy if exists announcement_images_select on storage.objects;
create policy announcement_images_select on storage.objects
for select to public using (bucket_id = 'announcement-images');

drop policy if exists announcement_images_insert on storage.objects;
create policy announcement_images_insert on storage.objects
for insert to public with check (bucket_id = 'announcement-images');

drop policy if exists announcement_images_update on storage.objects;
create policy announcement_images_update on storage.objects
for update to public using (bucket_id = 'announcement-images') with check (bucket_id = 'announcement-images');

drop policy if exists announcement_images_delete on storage.objects;
create policy announcement_images_delete on storage.objects
for delete to public using (bucket_id = 'announcement-images');
