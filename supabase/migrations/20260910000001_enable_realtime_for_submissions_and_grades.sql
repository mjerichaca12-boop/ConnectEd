-- 20260910000001_enable_realtime_for_submissions_and_grades.sql
-- Ensure real-time publications are active for student submissions, grades, and quiz attempts

DO $$
BEGIN
  -- Add teacher_assessment_submissions to supabase_realtime publication if not already present
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_assessment_submissions;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_assessment_grades;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_attempts;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
