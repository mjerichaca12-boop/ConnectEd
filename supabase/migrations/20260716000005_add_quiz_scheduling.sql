-- Migration: Add quiz scheduling columns
-- Date: 2026-07-16

ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS available_from TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS show_score_immediately BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_correct_answers_after_submission BOOLEAN DEFAULT false;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
