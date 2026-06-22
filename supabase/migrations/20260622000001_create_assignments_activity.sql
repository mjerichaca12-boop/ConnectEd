-- Migration: Create assignments_activity table
-- Date: 2026-06-22

CREATE TABLE IF NOT EXISTS public.assignments_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assessment_type TEXT NOT NULL DEFAULT 'assignment' CHECK (assessment_type IN ('assignment', 'activity', 'quiz')),
    deadline TIMESTAMP WITH TIME ZONE,
    file_url TEXT,
    file_name TEXT,
    file_path TEXT,
    term TEXT NOT NULL DEFAULT 'Term 1' CHECK (term IN ('Term 1', 'Term 2', 'Term 3')),
    designation TEXT NOT NULL DEFAULT 'Assignment' CHECK (designation IN ('Quiz', 'Activity', 'Assignment', 'Exam')),
    max_points NUMERIC NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.assignments_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS assignments_activity_select ON public.assignments_activity;
CREATE POLICY assignments_activity_select
ON public.assignments_activity
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS assignments_activity_insert ON public.assignments_activity;
CREATE POLICY assignments_activity_insert
ON public.assignments_activity
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS assignments_activity_update ON public.assignments_activity;
CREATE POLICY assignments_activity_update
ON public.assignments_activity
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS assignments_activity_delete ON public.assignments_activity;
CREATE POLICY assignments_activity_delete
ON public.assignments_activity
FOR DELETE
TO authenticated
USING (true);

-- Grant basic permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments_activity TO authenticated, anon;

-- Create Indexes
CREATE INDEX IF NOT EXISTS assignments_activity_file_url_idx ON public.assignments_activity (file_url);
CREATE INDEX IF NOT EXISTS assignments_activity_updated_at_idx ON public.assignments_activity (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_activity_type ON public.assignments_activity (assessment_type);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
