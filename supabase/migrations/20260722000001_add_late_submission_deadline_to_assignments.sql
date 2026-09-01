-- Migration: Add late_submission_deadline column to assignments table
-- Date: 2026-07-22

ALTER TABLE public.assignments
ADD COLUMN IF NOT EXISTS late_submission_deadline TIMESTAMP WITH TIME ZONE;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
