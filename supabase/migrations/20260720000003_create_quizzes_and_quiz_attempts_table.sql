-- Create quizzes and quiz_attempts tables if not exists

CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    questions JSONB,
    file_url TEXT,
    file_name TEXT,
    file_path TEXT,
    assessment_type TEXT DEFAULT 'quiz',
    deadline TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID,
    assignment_id UUID,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    score INT,
    correct_count INT,
    total_questions INT,
    answers JSONB,
    response_text TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and add policies for public reading & writing
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quizzes_select ON public.quizzes;
CREATE POLICY quizzes_select ON public.quizzes FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO anon, authenticated;

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quiz_attempts_select ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_attempts_insert ON public.quiz_attempts;
DROP POLICY IF EXISTS quiz_attempts_update ON public.quiz_attempts;

CREATE POLICY quiz_attempts_select ON public.quiz_attempts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY quiz_attempts_insert ON public.quiz_attempts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY quiz_attempts_update ON public.quiz_attempts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO anon, authenticated;
