-- Create attendance_metadata table to store class-wide lesson tasks and summaries
CREATE TABLE IF NOT EXISTS public.attendance_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    task TEXT,
    summary TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT attendance_metadata_unique UNIQUE (teacher_id, subject_id, attendance_date)
);

-- Enable RLS
ALTER TABLE public.attendance_metadata ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_metadata TO authenticated;

-- Policies
DROP POLICY IF EXISTS "Attendance metadata is viewable by everyone." ON public.attendance_metadata;
CREATE POLICY "Attendance metadata is viewable by everyone." ON public.attendance_metadata FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage attendance metadata." ON public.attendance_metadata;
CREATE POLICY "Authenticated users can manage attendance metadata." ON public.attendance_metadata FOR ALL USING (auth.role() = 'authenticated');
