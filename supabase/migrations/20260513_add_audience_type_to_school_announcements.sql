-- Add audience_type to school_announcements table
-- This ensures compatibility with the student announcements view.

alter table if exists public.school_announcements
  add column if not exists audience_type text;

-- Update existing rows based on target_audience
update public.school_announcements
set audience_type = case
  when lower(trim(target_audience)) = 'students' then 'student'
  when lower(trim(target_audience)) = 'teacher' then 'teacher'
  else 'school'
end
where audience_type is null;

-- Set default and constraints
alter table if exists public.school_announcements
  alter column audience_type set default 'school';

alter table if exists public.school_announcements
  alter column audience_type set not null;

alter table if exists public.school_announcements
  drop constraint if exists school_announcements_audience_type_check;

alter table if exists public.school_announcements
  add constraint school_announcements_audience_type_check
  check (audience_type in ('student', 'teacher', 'school'));

create index if not exists school_announcements_audience_type_idx
  on public.school_announcements (audience_type);
