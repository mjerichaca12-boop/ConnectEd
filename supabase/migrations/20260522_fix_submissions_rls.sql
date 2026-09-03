-- Migration: Fix Submissions RLS Policies
-- Corrects the RLS policies on public.submissions to use the user_id column instead of student_id,
-- and dynamically determines teacher ownership by joining assignments_activity with subjects.

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 1. SELECT POLICIES
DROP POLICY IF EXISTS "Students can view their own submissions." ON public.submissions;
CREATE POLICY "Students can view their own submissions."
ON public.submissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Teachers can view submissions for their assignments." ON public.submissions;
CREATE POLICY "Teachers can view submissions for their assignments."
ON public.submissions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.assignments_activity a
        JOIN public.subjects s ON a.course_id = s.id
        WHERE a.id = assignment_id AND s.teacher_id = auth.uid()
    )
);

-- 2. INSERT POLICIES
DROP POLICY IF EXISTS "Students can submit." ON public.submissions;
CREATE POLICY "Students can submit."
ON public.submissions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. UPDATE POLICIES (Supports Upserts/Resubmissions)
DROP POLICY IF EXISTS "Students can update their submissions." ON public.submissions;
CREATE POLICY "Students can update their submissions."
ON public.submissions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Teachers can grade submissions." ON public.submissions;
CREATE POLICY "Teachers can grade submissions."
ON public.submissions FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.assignments_activity a
        JOIN public.subjects s ON a.course_id = s.id
        WHERE a.id = assignment_id AND s.teacher_id = auth.uid()
    )
);
