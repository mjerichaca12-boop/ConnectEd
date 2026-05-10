-- Migration: Replace Midterm/Final grading with Quarterly system
-- Date: 2026-05-05

-- Add quarterly grade columns to teacher_student_grades table
alter table public.teacher_student_grades
add column if not exists quarter1_grade numeric(5,2) not null default 0,
add column if not exists quarter2_grade numeric(5,2) not null default 0,
add column if not exists quarter3_grade numeric(5,2) not null default 0,
add column if not exists quarter4_grade numeric(5,2) not null default 0,
add column if not exists activity_grade numeric(5,2) not null default 0;

-- Migrate existing midterm and final data to quarterly format
-- Distribute midterm_grade to Q1 and Q2, final_grade to Q3 and Q4
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teacher_student_grades'
      and column_name = 'midterm_grade'
  )
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teacher_student_grades'
      and column_name = 'final_grade'
  ) then
    execute $sql$
      update public.teacher_student_grades
      set
        quarter1_grade = (midterm_grade * 0.5),
        quarter2_grade = (midterm_grade * 0.5),
        quarter3_grade = (final_grade * 0.5),
        quarter4_grade = (final_grade * 0.5)
      where midterm_grade > 0 or final_grade > 0
    $sql$;
  end if;
end $$;

-- Keep the old columns for backward compatibility but mark them as deprecated
-- They will be read-only going forward
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teacher_student_grades'
      and column_name = 'midterm_grade'
  ) then
    execute 'comment on column public.teacher_student_grades.midterm_grade is ''DEPRECATED: Use quarter1_grade and quarter2_grade instead''';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teacher_student_grades'
      and column_name = 'final_grade'
  ) then
    execute 'comment on column public.teacher_student_grades.final_grade is ''DEPRECATED: Use quarter3_grade and quarter4_grade instead''';
  end if;
end $$;

-- Ensure RLS policies are still in place
drop policy if exists teacher_student_grades_update_authenticated on public.teacher_student_grades;
create policy teacher_student_grades_update_authenticated
on public.teacher_student_grades
for update
to authenticated
using (true)
with check (true);

-- Create indexes for quarterly grades for better query performance
create index if not exists idx_teacher_student_grades_q1
  on public.teacher_student_grades(quarter1_grade);

create index if not exists idx_teacher_student_grades_q2
  on public.teacher_student_grades(quarter2_grade);

create index if not exists idx_teacher_student_grades_q3
  on public.teacher_student_grades(quarter3_grade);

create index if not exists idx_teacher_student_grades_q4
  on public.teacher_student_grades(quarter4_grade);
