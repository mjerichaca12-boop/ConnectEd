-- ============================================================
-- ConnectEd: Final Sync for Grades and Attendance
-- This ensures the view correctly maps to the underlying table
-- and handles both 'Active' and 'accepted' statuses.
-- ============================================================

-- 1. Ensure the underlying columns exist with correct types
ALTER TABLE public.teacher_student_assignments 
ADD COLUMN IF NOT EXISTS grades JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS attendance JSONB DEFAULT '{}'::jsonb;

-- 2. Completely REBUILD the enrollments view to avoid schema cache issues
DROP VIEW IF EXISTS public.enrollments CASCADE;

CREATE OR REPLACE VIEW public.enrollments AS
SELECT
    id,
    subject_id,
    student_id,
    CASE
        WHEN lower(status) = 'active' THEN 'accepted'
        ELSE lower(status)
    END AS status,
    created_at,
    grades AS grade, -- Expose as 'grade' for mobile app consistency
    attendance
FROM public.teacher_student_assignments;

-- 3. Re-grant permissions for the view
GRANT SELECT ON public.enrollments TO authenticated, anon, service_role;

-- 4. Ensure RLS is fixed for the underlying table
ALTER TABLE public.teacher_student_assignments ENABLE ROW LEVEL SECURITY;

-- Allow students to see their own records
DROP POLICY IF EXISTS "Students can view their own records" ON public.teacher_student_assignments;
CREATE POLICY "Students can view their own records" 
ON public.teacher_student_assignments 
FOR SELECT 
USING (auth.uid() = student_id);

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';
