-- Migration: Update to 3-Term Grading System and add Assessment Designations
-- Date: 2026-05-15

-- 1. Update teacher_student_grades for 3 terms
alter table public.teacher_student_grades
add column if not exists term1_grade numeric(5,2) not null default 0,
add column if not exists term2_grade numeric(5,2) not null default 0,
add column if not exists term3_grade numeric(5,2) not null default 0,
add column if not exists exam_grade numeric(5,2) not null default 0;

-- Update subjects table to track which term a subject belongs to
alter table public.subjects
add column if not exists term text not null default 'Term 1'
check (term in ('Term 1', 'Term 2', 'Term 3'));

-- Deprecate quarterly columns
comment on column public.teacher_student_grades.quarter1_grade is 'DEPRECATED: Use term1_grade instead';
comment on column public.teacher_student_grades.quarter2_grade is 'DEPRECATED: Use term2_grade instead';
comment on column public.teacher_student_grades.quarter3_grade is 'DEPRECATED: Use term3_grade instead';
comment on column public.teacher_student_grades.quarter4_grade is 'DEPRECATED: Use term3_grade instead';

-- 2. Update teacher_assessment_grades to support Terms and specific Designations
-- Add term column to track which term an assessment belongs to
alter table public.teacher_assessment_grades
add column if not exists term text not null default 'Term 1'
check (term in ('Term 1', 'Term 2', 'Term 3'));

-- Add designation column for specific categorization as requested
-- This allows more granular tracking beyond just the generic 'assessment_type'
alter table public.teacher_assessment_grades
add column if not exists designation text not null default 'Activity'
check (designation in ('Quiz', 'Activity', 'Assignment', 'Exam'));

-- Add term and designation to teacher_assessment_submissions (if applicable)
-- Checking if it exists first
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'teacher_assessment_submissions') then
    alter table public.teacher_assessment_submissions 
    add column if not exists term text not null default 'Term 1'
    check (term in ('Term 1', 'Term 2', 'Term 3'));
    
    alter table public.teacher_assessment_submissions
    add column if not exists designation text not null default 'Activity'
    check (designation in ('Quiz', 'Activity', 'Assignment', 'Exam'));
  end if;
end $$;

-- 3. Update existing assignments/activities table if it exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'assignments_activity') then
    alter table public.assignments_activity
    add column if not exists term text not null default 'Term 1'
    check (term in ('Term 1', 'Term 2', 'Term 3'));
    
    alter table public.assignments_activity
    add column if not exists designation text not null default 'Activity'
    check (designation in ('Quiz', 'Activity', 'Assignment', 'Exam'));
  end if;
end $$;

-- 4. Create indexes for the new columns
create index if not exists idx_teacher_student_grades_term1 on public.teacher_student_grades(term1_grade);
create index if not exists idx_teacher_student_grades_term2 on public.teacher_student_grades(term2_grade);
create index if not exists idx_teacher_student_grades_term3 on public.teacher_student_grades(term3_grade);

create index if not exists idx_teacher_assessment_grades_term_designation 
on public.teacher_assessment_grades(term, designation);
