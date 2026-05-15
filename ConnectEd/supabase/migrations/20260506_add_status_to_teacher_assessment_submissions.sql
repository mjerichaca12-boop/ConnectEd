alter table public.teacher_assessment_submissions
add column if not exists status text not null default 'pending';

create index if not exists idx_teacher_assessment_submissions_status
  on public.teacher_assessment_submissions(status);

-- keep RLS policies permissive as existing migrations; updated column will be covered by existing policies
