-- Add assessment_type column to assignments_activity table to support quizzes
ALTER TABLE public.assignments_activity 
ADD COLUMN assessment_type text NOT NULL DEFAULT 'assignment' CHECK (assessment_type = ANY (ARRAY['assignment'::text, 'activity'::text, 'quiz'::text]));

-- Add index on assessment_type for better query performance
CREATE INDEX idx_assignments_activity_type ON public.assignments_activity(assessment_type);

-- Add comment to document the new column
COMMENT ON COLUMN public.assignments_activity.assessment_type IS 'Type of assessment: assignment, activity, or quiz';
