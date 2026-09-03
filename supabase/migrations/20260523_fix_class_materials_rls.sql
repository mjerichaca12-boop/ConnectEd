-- Fix class_materials RLS policies and table columns
-- 1. Ensure the created_by column exists on class_materials
alter table public.class_materials add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- 2. Drop the redundant or broken policies
drop policy if exists class_materials_select_authenticated on public.class_materials;
drop policy if exists class_materials_insert_teachers on public.class_materials;
drop policy if exists class_materials_update_own on public.class_materials;
drop policy if exists class_materials_delete_own on public.class_materials;
drop policy if exists "Materials are viewable by everyone" on public.class_materials;
drop policy if exists "Materials are viewable by everyone." on public.class_materials;
drop policy if exists "Teachers can insert class materials" on public.class_materials;
drop policy if exists "Teachers can update their own class materials" on public.class_materials;
drop policy if exists "Teachers can delete their own class materials" on public.class_materials;

-- 3. Create fresh, correct and stable RLS policies
-- SELECT policy
create policy "Materials are viewable by everyone"
  on public.class_materials
  for select
  to public
  using (true);

-- INSERT policy
create policy "Teachers can insert class materials"
  on public.class_materials
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and role = 'teacher'
    ) and
    (auth.uid() = teacher_id or auth.uid() = created_by)
  );

-- UPDATE policy
create policy "Teachers can update their own class materials"
  on public.class_materials
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and role = 'teacher'
    ) and
    (auth.uid() = teacher_id or auth.uid() = created_by)
  );

-- DELETE policy
create policy "Teachers can delete their own class materials"
  on public.class_materials
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and role = 'teacher'
    ) and
    (auth.uid() = teacher_id or auth.uid() = created_by)
  );
