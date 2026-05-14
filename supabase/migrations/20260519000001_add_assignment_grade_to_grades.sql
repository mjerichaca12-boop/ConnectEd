-- Migration: Add assignment_grade column to teacher_student_grades
-- Date: 2026-05-19

alter table public.teacher_student_grades
add column if not exists assignment_grade numeric(5,2) not null default 0;

create index if not exists idx_teacher_student_grades_assignment on public.teacher_student_grades(assignment_grade);
