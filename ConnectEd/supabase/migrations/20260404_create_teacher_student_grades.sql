create table if not exists public.teacher_student_grades (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  quarter1_grade numeric(5,2) not null default 0,
  quarter2_grade numeric(5,2) not null default 0,
  quarter3_grade numeric(5,2) not null default 0,
  quarter4_grade numeric(5,2) not null default 0,
  quiz_average numeric(5,2) not null default 0,
  project_grade numeric(5,2) not null default 0,
  activity_grade numeric(5,2) not null default 0,
  overall_grade numeric(5,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (teacher_id, subject_id, student_id)
);

create index if not exists idx_teacher_student_grades_teacher
  on public.teacher_student_grades(teacher_id);

create index if not exists idx_teacher_student_grades_subject
  on public.teacher_student_grades(subject_id);

create index if not exists idx_teacher_student_grades_student
  on public.teacher_student_grades(student_id);

create index if not exists idx_teacher_student_grades_q1
  on public.teacher_student_grades(quarter1_grade);

create index if not exists idx_teacher_student_grades_q2
  on public.teacher_student_grades(quarter2_grade);

create index if not exists idx_teacher_student_grades_q3
  on public.teacher_student_grades(quarter3_grade);

create index if not exists idx_teacher_student_grades_q4
  on public.teacher_student_grades(quarter4_grade);

create index if not exists idx_teacher_student_grades_updated_at
  on public.teacher_student_grades(updated_at desc);

alter table public.teacher_student_grades enable row level security;

grant select, insert, update, delete on public.teacher_student_grades to authenticated;

drop policy if exists teacher_student_grades_select_authenticated on public.teacher_student_grades;
create policy teacher_student_grades_select_authenticated
on public.teacher_student_grades
for select
to authenticated
using (true);

drop policy if exists teacher_student_grades_insert_authenticated on public.teacher_student_grades;
create policy teacher_student_grades_insert_authenticated
on public.teacher_student_grades
for insert
to authenticated
with check (true);

drop policy if exists teacher_student_grades_update_authenticated on public.teacher_student_grades;
create policy teacher_student_grades_update_authenticated
on public.teacher_student_grades
for update
to authenticated
using (true)
with check (true);

drop policy if exists teacher_student_grades_delete_authenticated on public.teacher_student_grades;
create policy teacher_student_grades_delete_authenticated
on public.teacher_student_grades
for delete
to authenticated
using (true);
