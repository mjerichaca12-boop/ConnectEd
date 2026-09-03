-- ============================================================
-- Fix Enrollment and Subject RLS Permissions
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure teacher_student_assignments has RLS enabled
ALTER TABLE public.teacher_student_assignments ENABLE ROW LEVEL SECURITY;

-- 2. Allow students to view their own enrollments
DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.teacher_student_assignments;
CREATE POLICY "Students can view their own enrollments" 
ON public.teacher_student_assignments 
FOR SELECT 
USING (auth.uid() = student_id);

-- 3. Allow teachers to view enrollments for their subjects
DROP POLICY IF EXISTS "Teachers can view enrollments for their subjects" ON public.teacher_student_assignments;
CREATE POLICY "Teachers can view enrollments for their subjects" 
ON public.teacher_student_assignments 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.subjects 
        WHERE id = subject_id AND teacher_id = auth.uid()
    )
);

-- 4. Allow students to insert enrollment requests (apply for subject)
DROP POLICY IF EXISTS "Students can apply for subjects" ON public.teacher_student_assignments;
CREATE POLICY "Students can apply for subjects" 
ON public.teacher_student_assignments 
FOR INSERT 
WITH CHECK (auth.uid() = student_id);

-- 5. Ensure subjects are viewable by everyone (students need this to see subject names)
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subjects are viewable by everyone" ON public.subjects;
CREATE POLICY "Subjects are viewable by everyone" 
ON public.subjects 
FOR SELECT 
USING (true);

-- 6. Refresh the schema cache
NOTIFY pgrst, 'reload schema';
