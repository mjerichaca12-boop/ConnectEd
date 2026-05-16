alter table if exists public.teacher_assessment_grades
add column if not exists status text not null default 'Pending';

create index if not exists idx_teacher_assessment_grades_status
  on public.teacher_assessment_grades(status);
