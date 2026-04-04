create table if not exists public.class_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_type text not null,
  file_url text not null,
  file_name text not null,
  file_path text,
  subject text,
  section text,
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.class_materials add column if not exists file_path text;
alter table public.class_materials add column if not exists subject text;
alter table public.class_materials add column if not exists section text;

create index if not exists idx_class_materials_teacher_id
  on public.class_materials(teacher_id);

create index if not exists idx_class_materials_created_at
  on public.class_materials(created_at desc);

alter table public.class_materials enable row level security;

grant select, insert, update, delete on public.class_materials to anon, authenticated;

drop policy if exists class_materials_select_authenticated on public.class_materials;
create policy class_materials_select_authenticated
on public.class_materials
for select
to public
using (true);

drop policy if exists class_materials_insert_authenticated on public.class_materials;
create policy class_materials_insert_authenticated
on public.class_materials
for insert
to public
with check (true);

drop policy if exists class_materials_update_authenticated on public.class_materials;
create policy class_materials_update_authenticated
on public.class_materials
for update
to public
using (true)
with check (true);

drop policy if exists class_materials_delete_authenticated on public.class_materials;
create policy class_materials_delete_authenticated
on public.class_materials
for delete
to public
using (true);
