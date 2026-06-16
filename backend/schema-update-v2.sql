-- ============================================================
-- ConnectEd: Schema Update v2 (Grades, Assignments)
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. ADD GRADES TO teacher_student_assignments
ALTER TABLE public.teacher_student_assignments 
ADD COLUMN IF NOT EXISTS grades JSONB DEFAULT '{}'::jsonb;

-- 2. RECREATE ENROLLMENTS VIEW TO EXPOSE THESE NEW COLUMNS
DROP VIEW IF EXISTS public.enrollments;

CREATE OR REPLACE VIEW public.enrollments AS
SELECT
    id,
    subject_id,
    student_id,
    CASE
        WHEN lower(status) = 'active' THEN 'accepted'
        ELSE lower(status)
    END AS status,
    created_at,
    grades AS grade
FROM public.teacher_student_assignments;

GRANT SELECT, UPDATE ON public.enrollments TO authenticated, anon, service_role;

-- 3. ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Assignments are viewable by everyone." ON public.assignments;
CREATE POLICY "Assignments are viewable by everyone." ON public.assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Teachers can manage assignments." ON public.assignments;
CREATE POLICY "Teachers can manage assignments." ON public.assignments FOR ALL USING (auth.uid() = teacher_id);

-- 4. SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT,
    status TEXT DEFAULT 'submitted', -- 'submitted', 'graded', 'late'
    grade NUMERIC,
    teacher_comment TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(assignment_id, student_id)
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view their own submissions." ON public.submissions;
CREATE POLICY "Students can view their own submissions." ON public.submissions FOR SELECT USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Teachers can view submissions for their assignments." ON public.submissions;
CREATE POLICY "Teachers can view submissions for their assignments." ON public.submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.assignments WHERE id = assignment_id AND teacher_id = auth.uid())
);
DROP POLICY IF EXISTS "Students can submit." ON public.submissions;
CREATE POLICY "Students can submit." ON public.submissions FOR INSERT WITH CHECK (auth.uid() = student_id);
DROP POLICY IF EXISTS "Students can update their submissions." ON public.submissions;
CREATE POLICY "Students can update their submissions." ON public.submissions FOR UPDATE USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Teachers can grade submissions." ON public.submissions;
CREATE POLICY "Teachers can grade submissions." ON public.submissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.assignments WHERE id = assignment_id AND teacher_id = auth.uid())
);

-- REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
