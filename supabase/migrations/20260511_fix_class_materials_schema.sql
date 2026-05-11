-- Fix class_materials table schema to match code expectations
-- Add missing columns that the frontend code expects

-- Add file_name column
alter table public.class_materials add column if not exists file_name text;

-- Add file_path column
alter table public.class_materials add column if not exists file_path text;

-- Add subject column (text field, separate from subject_id)
alter table public.class_materials add column if not exists subject text;

-- Add section column
alter table public.class_materials add column if not exists section text;

-- Add created_by column
alter table public.class_materials add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- Create indexes for performance
create index if not exists idx_class_materials_file_path on public.class_materials(file_path);
create index if not exists idx_class_materials_subject on public.class_materials(subject);
create index if not exists idx_class_materials_section on public.class_materials(section);
create index if not exists idx_class_materials_created_by on public.class_materials(created_by);

-- Update RLS policies to support both teacher_id and created_by
drop policy if exists "Materials are viewable by everyone." on public.class_materials;
drop policy if exists "Teachers can delete their own class materials" on public.class_materials;
drop policy if exists "Teachers can insert class materials" on public.class_materials;
drop policy if exists "Teachers can update their own class materials" on public.class_materials;

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
