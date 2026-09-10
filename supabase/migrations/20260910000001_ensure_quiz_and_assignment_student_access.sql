-- Migration: Ensure student SELECT access on quizzes, quiz_questions, lesson_activities, lessons, and assignments
-- Date: 2026-09-10

-- 1. Quizzes table
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quizzes_select ON public.quizzes;
CREATE POLICY quizzes_select ON public.quizzes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS quizzes_all ON public.quizzes;
CREATE POLICY quizzes_all ON public.quizzes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO anon, authenticated;

-- 2. Quiz questions table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_type TEXT NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT,
    points INT DEFAULT 1,
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quiz_questions_select ON public.quiz_questions;
CREATE POLICY quiz_questions_select ON public.quiz_questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS quiz_questions_all ON public.quiz_questions;
CREATE POLICY quiz_questions_all ON public.quiz_questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO anon, authenticated;

-- 3. Lesson activities junction table
ALTER TABLE IF EXISTS public.lesson_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lesson_activities_select ON public.lesson_activities;
CREATE POLICY lesson_activities_select ON public.lesson_activities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS lesson_activities_all ON public.lesson_activities;
CREATE POLICY lesson_activities_all ON public.lesson_activities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_activities TO anon, authenticated;

-- 4. Lessons table
ALTER TABLE IF EXISTS public.lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lessons_select ON public.lessons;
CREATE POLICY lessons_select ON public.lessons FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS lessons_all ON public.lessons;
CREATE POLICY lessons_all ON public.lessons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO anon, authenticated;

-- 5. Assignments table
ALTER TABLE IF EXISTS public.assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assignments_select ON public.assignments;
CREATE POLICY assignments_select ON public.assignments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS assignments_all ON public.assignments;
CREATE POLICY assignments_all ON public.assignments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO anon, authenticated;

-- 6. Assignments activity table
ALTER TABLE IF EXISTS public.assignments_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assignments_activity_select ON public.assignments_activity;
CREATE POLICY assignments_activity_select ON public.assignments_activity FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS assignments_activity_all ON public.assignments_activity;
CREATE POLICY assignments_activity_all ON public.assignments_activity FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments_activity TO anon, authenticated;

-- 7. Realtime publications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quizzes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quiz_questions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_questions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lesson_activities') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_activities;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lessons') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assignments_activity') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments_activity;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
