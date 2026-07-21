-- Fix RLS Policies for Quizzes, Assignments, Submissions and Assessment Grades

-- 1. assignments_activity: Allow all users to view quizzes and assignments
ALTER TABLE IF EXISTS public.assignments_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assignments_activity_select ON public.assignments_activity;
CREATE POLICY assignments_activity_select ON public.assignments_activity FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT, INSERT, UPDATE ON public.assignments_activity TO anon, authenticated;

-- 2. teacher_assessment_submissions: Allow students to submit quiz answers
ALTER TABLE IF EXISTS public.teacher_assessment_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teacher_assessment_submissions_select ON public.teacher_assessment_submissions;
DROP POLICY IF EXISTS teacher_assessment_submissions_insert ON public.teacher_assessment_submissions;
DROP POLICY IF EXISTS teacher_assessment_submissions_update ON public.teacher_assessment_submissions;
DROP POLICY IF EXISTS teacher_assessment_submissions_delete ON public.teacher_assessment_submissions;

CREATE POLICY teacher_assessment_submissions_select ON public.teacher_assessment_submissions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY teacher_assessment_submissions_insert ON public.teacher_assessment_submissions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY teacher_assessment_submissions_update ON public.teacher_assessment_submissions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY teacher_assessment_submissions_delete ON public.teacher_assessment_submissions FOR DELETE TO anon, authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_assessment_submissions TO anon, authenticated;

-- 3. teacher_assessment_grades: Allow auto-graded quiz scores to be recorded
ALTER TABLE IF EXISTS public.teacher_assessment_grades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teacher_assessment_grades_select ON public.teacher_assessment_grades;
DROP POLICY IF EXISTS teacher_assessment_grades_insert ON public.teacher_assessment_grades;
DROP POLICY IF EXISTS teacher_assessment_grades_update ON public.teacher_assessment_grades;

CREATE POLICY teacher_assessment_grades_select ON public.teacher_assessment_grades FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY teacher_assessment_grades_insert ON public.teacher_assessment_grades FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY teacher_assessment_grades_update ON public.teacher_assessment_grades FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE ON public.teacher_assessment_grades TO anon, authenticated;
