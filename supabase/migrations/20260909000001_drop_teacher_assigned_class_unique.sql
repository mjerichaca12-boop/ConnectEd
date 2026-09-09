-- Drop unique constraint/index on teacher assigned_class since multiple teachers can teach the same section
DROP INDEX IF EXISTS public.profiles_teacher_assigned_class_unique;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_teacher_assigned_class_unique;
