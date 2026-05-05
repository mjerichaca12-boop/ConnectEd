create table if not exists public.teacher_assessment_grades (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  assessment_id text not null,
  assessment_title text not null default '',
  assessment_type text not null default 'assignment',
  max_points numeric(7,2) not null default 100,
  student_id uuid not null references public.profiles(id) on delete cascade,
  grade_value numeric(7,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_assessment_grades_unique
    unique (teacher_id, subject_id, assessment_id, student_id),
  constraint teacher_assessment_grades_grade_non_negative
    check (grade_value >= 0),
  constraint teacher_assessment_grades_max_points_positive
    check (max_points > 0)
);

create index if not exists idx_teacher_assessment_grades_teacher
  on public.teacher_assessment_grades(teacher_id);

create index if not exists idx_teacher_assessment_grades_subject
  on public.teacher_assessment_grades(subject_id);

create index if not exists idx_teacher_assessment_grades_assessment
  on public.teacher_assessment_grades(assessment_id);

create index if not exists idx_teacher_assessment_grades_student
  on public.teacher_assessment_grades(student_id);

create index if not exists idx_teacher_assessment_grades_updated_at
  on public.teacher_assessment_grades(updated_at desc);

alter table public.teacher_assessment_grades enable row level security;

grant select, insert, update, delete on public.teacher_assessment_grades to authenticated;

drop policy if exists teacher_assessment_grades_select_authenticated on public.teacher_assessment_grades;
create policy teacher_assessment_grades_select_authenticated
on public.teacher_assessment_grades
for select
to authenticated
using (true);

drop policy if exists teacher_assessment_grades_insert_authenticated on public.teacher_assessment_grades;
create policy teacher_assessment_grades_insert_authenticated
on public.teacher_assessment_grades
for insert
to authenticated
with check (true);

drop policy if exists teacher_assessment_grades_update_authenticated on public.teacher_assessment_grades;
create policy teacher_assessment_grades_update_authenticated
on public.teacher_assessment_grades
for update
to authenticated
using (true)
with check (true);

drop policy if exists teacher_assessment_grades_delete_authenticated on public.teacher_assessment_grades;
create policy teacher_assessment_grades_delete_authenticated
on public.teacher_assessment_grades
for delete
to authenticated
using (true);
