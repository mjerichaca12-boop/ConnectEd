alter table if exists public.subjects enable row level security;

grant select, insert, update, delete on public.subjects to anon, authenticated;

drop policy if exists subjects_select_all on public.subjects;
create policy subjects_select_all
on public.subjects
for select
to anon, authenticated
using (true);

drop policy if exists subjects_insert_all on public.subjects;
create policy subjects_insert_all
on public.subjects
for insert
to anon, authenticated
with check (true);

drop policy if exists subjects_update_all on public.subjects;
create policy subjects_update_all
on public.subjects
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists subjects_delete_all on public.subjects;
create policy subjects_delete_all
on public.subjects
for delete
to anon, authenticated
using (true);
