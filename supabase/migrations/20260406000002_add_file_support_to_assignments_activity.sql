-- Add file attachment support to assignments_activity table
alter table if exists public.assignments_activity
add column if not exists file_url text,
add column if not exists file_name text,
add column if not exists file_path text;

-- Create an index on file_url for faster lookups
create index if not exists assignments_activity_file_url_idx
  on public.assignments_activity (file_url);
