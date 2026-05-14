-- Add category column to announcements and school_announcements tables
alter table if exists public.announcements
  add column if not exists category text default 'General';

alter table if exists public.school_announcements
  add column if not exists category text default 'General';

-- Update constraints if needed (optional, but good for data integrity)
alter table if exists public.announcements
  drop constraint if exists announcements_category_check;

alter table if exists public.announcements
  add constraint announcements_category_check
  check (category in ('General', 'Lesson Plan', 'Task', 'School Info'));

alter table if exists public.school_announcements
  drop constraint if exists school_announcements_category_check;

alter table if exists public.school_announcements
  add constraint school_announcements_category_check
  check (category in ('General', 'Lesson Plan', 'Task', 'School Info'));
