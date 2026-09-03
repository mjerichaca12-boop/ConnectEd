-- ============================================================
-- ConnectEd Migration: Update Enrollments View to Include Section
-- ============================================================

-- Recreate view to select the 'section' column from 'teacher_student_assignments'
CREATE OR REPLACE VIEW public.enrollments AS
SELECT
    id,
    subject_id,
    student_id,
    section, -- <-- Expose section dynamically from student assignments
    CASE
        WHEN lower(status) = 'active' THEN 'accepted'
        ELSE lower(status)
    END AS status,
    created_at,
    grades AS grade, -- Keep grades JSON mapping intact
    attendance -- Keep attendance JSON mapping intact
FROM public.teacher_student_assignments;

-- Grant select permission to standard roles
GRANT SELECT ON public.enrollments TO authenticated, anon, service_role;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
