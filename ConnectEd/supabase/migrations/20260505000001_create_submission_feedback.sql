-- Create submission_feedback table to store teacher feedback on submissions
-- Date: 2026-05-05

create table if not exists public.submission_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.teacher_assessment_submissions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  comments text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submission_feedback_unique unique (submission_id, teacher_id)
);

create index if not exists idx_submission_feedback_submission on public.submission_feedback(submission_id);
create index if not exists idx_submission_feedback_teacher on public.submission_feedback(teacher_id);

alter table public.submission_feedback enable row level security;

grant select, insert, update, delete on public.submission_feedback to authenticated;

drop policy if exists submission_feedback_select_authenticated on public.submission_feedback;
create policy submission_feedback_select_authenticated
on public.submission_feedback
for select
to authenticated
using (true);

drop policy if exists submission_feedback_insert_authenticated on public.submission_feedback;
create policy submission_feedback_insert_authenticated
on public.submission_feedback
for insert
to authenticated
with check (true);

drop policy if exists submission_feedback_update_authenticated on public.submission_feedback;
create policy submission_feedback_update_authenticated
on public.submission_feedback
for update
to authenticated
using (true)
with check (true);

drop policy if exists submission_feedback_delete_authenticated on public.submission_feedback;
create policy submission_feedback_delete_authenticated
on public.submission_feedback
for delete
to authenticated
using (true);
