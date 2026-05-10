alter table if exists public.teacher_assessment_grades
add column if not exists feedback text;

comment on column public.teacher_assessment_grades.feedback is 'Teacher feedback returned with the assessment grade';
