create table if not exists public.teacher_student_attendance (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attendance_date date not null,
  attendance_status text not null,
  remarks text,
  updated_at timestamptz not null default now(),
  constraint teacher_student_attendance_unique
    unique (teacher_id, subject_id, student_id, attendance_date),
  constraint teacher_student_attendance_status_check
    check (attendance_status in ('Present', 'Absent', 'Late'))
);

create index if not exists idx_teacher_student_attendance_teacher
  on public.teacher_student_attendance(teacher_id);

create index if not exists idx_teacher_student_attendance_subject
  on public.teacher_student_attendance(subject_id);

create index if not exists idx_teacher_student_attendance_student
  on public.teacher_student_attendance(student_id);

create index if not exists idx_teacher_student_attendance_date
  on public.teacher_student_attendance(attendance_date desc);

alter table public.teacher_student_attendance enable row level security;

grant select, insert, update, delete on public.teacher_student_attendance to authenticated;

drop policy if exists teacher_student_attendance_select_authenticated on public.teacher_student_attendance;
create policy teacher_student_attendance_select_authenticated
on public.teacher_student_attendance
for select
to authenticated
using (true);

drop policy if exists teacher_student_attendance_insert_authenticated on public.teacher_student_attendance;
create policy teacher_student_attendance_insert_authenticated
on public.teacher_student_attendance
for insert
to authenticated
with check (true);

drop policy if exists teacher_student_attendance_update_authenticated on public.teacher_student_attendance;
create policy teacher_student_attendance_update_authenticated
on public.teacher_student_attendance
for update
to authenticated
using (true)
with check (true);

drop policy if exists teacher_student_attendance_delete_authenticated on public.teacher_student_attendance;
create policy teacher_student_attendance_delete_authenticated
on public.teacher_student_attendance
for delete
to authenticated
using (true);
