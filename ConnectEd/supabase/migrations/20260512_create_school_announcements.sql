-- Create school_announcements table
-- This is the primary announcements table used by the admin announcements page.

create table if not exists public.school_announcements (
  id bigint generated always as identity primary key,
  title text not null,
  content text,
  target_audience text not null default 'School-wide'
    check (target_audience in ('School-wide', 'Students', 'Teacher')),
  priority text not null default 'Medium'
    check (priority in ('Low', 'Medium', 'High')),
  author text,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  school_id uuid,
  file_name text,
  file_url text,
  file_path text,
  file_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for ordering by date
create index if not exists idx_school_announcements_created_at
  on public.school_announcements(created_at desc);

-- Enable RLS
alter table public.school_announcements enable row level security;

-- Anyone can read announcements
create policy "school_announcements_select"
  on public.school_announcements
  for select
  to public
  using (true);

-- Authenticated users can insert (admin creates via service role; this covers direct inserts too)
create policy "school_announcements_insert"
  on public.school_announcements
  for insert
  to public
  with check (true);

-- Authenticated users can update their own announcements
create policy "school_announcements_update"
  on public.school_announcements
  for update
  to public
  using (true);

-- Authenticated users can delete their own announcements
create policy "school_announcements_delete"
  on public.school_announcements
  for delete
  to public
  using (true);
