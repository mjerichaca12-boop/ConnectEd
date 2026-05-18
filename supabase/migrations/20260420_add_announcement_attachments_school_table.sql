alter table if exists public.school_announcements
  add column if not exists file_name text,
  add column if not exists file_url text,
  add column if not exists file_path text,
  add column if not exists file_type text;
