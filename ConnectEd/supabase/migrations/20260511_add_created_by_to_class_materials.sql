-- Add created_by column to class_materials table for consistency
-- This fixes the 400 errors when the app tries to detect this column

alter table public.class_materials add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- Create index for better performance
create index if not exists idx_class_materials_created_by on public.class_materials(created_by);

-- Ensure RLS policies are properly configured
-- Drop existing policies that might conflict
drop policy if exists "Materials are viewable by everyone." on public.class_materials;
drop policy if exists "Teachers can delete their own class materials" on public.class_materials;
drop policy if exists "Teachers can insert class materials" on public.class_materials;
drop policy if exists "Teachers can update their own class materials" on public.class_materials;

-- Create proper RLS policies that work with both teacher_id and created_by
-- Policy: Materials are viewable by everyone
create policy "Materials are viewable by everyone."
  on public.class_materials
  for select
  to public
  using (true);

-- Policy: Only teachers can insert class materials (supports both teacher_id and created_by)
create policy "Teachers can insert class materials"
  on public.class_materials
  for insert
  to public
  with check (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and role = 'teacher'
    ) and
    (auth.uid() = teacher_id or auth.uid() = created_by)
  );

-- Policy: Only teachers who created the material can update it
create policy "Teachers can update their own class materials"
  on public.class_materials
  for update
  to public
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and role = 'teacher'
    ) and
    (auth.uid() = teacher_id or auth.uid() = created_by)
  );

-- Policy: Only teachers who created the material can delete it
create policy "Teachers can delete their own class materials"
  on public.class_materials
  for delete
  to public
  using (
    exists (
      select 1 from public.profiles 
      where id = auth.uid() 
      and role = 'teacher'
    ) and
    (auth.uid() = teacher_id or auth.uid() = created_by)
  );
