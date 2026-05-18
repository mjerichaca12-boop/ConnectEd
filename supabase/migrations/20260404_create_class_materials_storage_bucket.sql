insert into storage.buckets (id, name, public)
values ('class-materials', 'class-materials', true)
on conflict (id) do nothing;

update storage.buckets
set public = true
where id = 'class-materials';

drop policy if exists class_materials_storage_select_authenticated on storage.objects;
create policy class_materials_storage_select_authenticated
on storage.objects
for select
to public
using (bucket_id = 'class-materials');

drop policy if exists class_materials_storage_insert_authenticated on storage.objects;
create policy class_materials_storage_insert_authenticated
on storage.objects
for insert
to public
with check (bucket_id = 'class-materials');

drop policy if exists class_materials_storage_update_authenticated on storage.objects;
create policy class_materials_storage_update_authenticated
on storage.objects
for update
to public
using (bucket_id = 'class-materials')
with check (bucket_id = 'class-materials');

drop policy if exists class_materials_storage_delete_authenticated on storage.objects;
create policy class_materials_storage_delete_authenticated
on storage.objects
for delete
to public
using (bucket_id = 'class-materials');
