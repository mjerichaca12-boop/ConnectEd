-- Migration: Add Submissions DELETE Policy
-- This script adds the missing DELETE policy on public.submissions
-- so students can cleanly delete/undo their submissions under RLS.

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can delete their own submissions." ON public.submissions;

CREATE POLICY "Students can delete their own submissions."
ON public.submissions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
