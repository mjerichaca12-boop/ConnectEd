create table if not exists public.teacher_assessment_submissions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  assessment_id text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  response_text text,
  file_url text,
  file_name text,
  file_path text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_assessment_submissions_unique
    unique (teacher_id, subject_id, assessment_id, student_id)
);

create index if not exists idx_teacher_assessment_submissions_teacher
  on public.teacher_assessment_submissions(teacher_id);

create index if not exists idx_teacher_assessment_submissions_subject
  on public.teacher_assessment_submissions(subject_id);

create index if not exists idx_teacher_assessment_submissions_assessment
  on public.teacher_assessment_submissions(assessment_id);

create index if not exists idx_teacher_assessment_submissions_student
  on public.teacher_assessment_submissions(student_id);

create index if not exists idx_teacher_assessment_submissions_submitted_at
  on public.teacher_assessment_submissions(submitted_at desc);

alter table public.teacher_assessment_submissions enable row level security;

grant select, insert, update, delete on public.teacher_assessment_submissions to authenticated;

drop policy if exists teacher_assessment_submissions_select_authenticated on public.teacher_assessment_submissions;
create policy teacher_assessment_submissions_select_authenticated
on public.teacher_assessment_submissions
for select
to authenticated
using (true);

drop policy if exists teacher_assessment_submissions_insert_authenticated on public.teacher_assessment_submissions;
create policy teacher_assessment_submissions_insert_authenticated
on public.teacher_assessment_submissions
for insert
to authenticated
with check (true);

drop policy if exists teacher_assessment_submissions_update_authenticated on public.teacher_assessment_submissions;
create policy teacher_assessment_submissions_update_authenticated
on public.teacher_assessment_submissions
for update
to authenticated
using (true)
with check (true);

drop policy if exists teacher_assessment_submissions_delete_authenticated on public.teacher_assessment_submissions;
create policy teacher_assessment_submissions_delete_authenticated
on public.teacher_assessment_submissions
for delete
to authenticated
using (true);
