-- Migration: 20260910000003_fix_teacher_deletion_cascade.sql
-- Ensure clean CASCADE or SET NULL on foreign keys referencing public.profiles(id) for teacher deletion

-- 1. teacher_student_grades
ALTER TABLE IF EXISTS public.teacher_student_grades
  DROP CONSTRAINT IF EXISTS teacher_student_grades_teacher_id_fkey;

ALTER TABLE IF EXISTS public.teacher_student_grades
  ADD CONSTRAINT teacher_student_grades_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. teacher_student_assignments
ALTER TABLE IF EXISTS public.teacher_student_assignments
  DROP CONSTRAINT IF EXISTS teacher_student_assignments_teacher_id_fkey;

ALTER TABLE IF EXISTS public.teacher_student_assignments
  ADD CONSTRAINT teacher_student_assignments_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. teacher_assessment_grades
ALTER TABLE IF EXISTS public.teacher_assessment_grades
  DROP CONSTRAINT IF EXISTS teacher_assessment_grades_teacher_id_fkey;

ALTER TABLE IF EXISTS public.teacher_assessment_grades
  ADD CONSTRAINT teacher_assessment_grades_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. teacher_assessment_submissions
ALTER TABLE IF EXISTS public.teacher_assessment_submissions
  DROP CONSTRAINT IF EXISTS teacher_assessment_submissions_teacher_id_fkey;

ALTER TABLE IF EXISTS public.teacher_assessment_submissions
  ADD CONSTRAINT teacher_assessment_submissions_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. subjects
ALTER TABLE IF EXISTS public.subjects
  DROP CONSTRAINT IF EXISTS subjects_teacher_id_fkey;

ALTER TABLE IF EXISTS public.subjects
  ADD CONSTRAINT subjects_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. lessons
ALTER TABLE IF EXISTS public.lessons
  DROP CONSTRAINT IF EXISTS lessons_teacher_id_fkey;

ALTER TABLE IF EXISTS public.lessons
  ADD CONSTRAINT lessons_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 7. class_materials
ALTER TABLE IF EXISTS public.class_materials
  DROP CONSTRAINT IF EXISTS class_materials_teacher_id_fkey;

ALTER TABLE IF EXISTS public.class_materials
  ADD CONSTRAINT class_materials_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 8. class_announcements
ALTER TABLE IF EXISTS public.class_announcements
  DROP CONSTRAINT IF EXISTS class_announcements_teacher_id_fkey;

ALTER TABLE IF EXISTS public.class_announcements
  ADD CONSTRAINT class_announcements_teacher_id_fkey
  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
