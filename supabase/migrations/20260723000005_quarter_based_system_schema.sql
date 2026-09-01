-- 20260723000005_quarter_based_system_schema.sql
-- Add school_year and term (quarter) to all academic tables

-- Ensure term exists for lessons
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS term text;

-- Ensure term exists for class_materials
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS term text;

-- Ensure term exists for class_announcements
ALTER TABLE public.class_announcements ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.class_announcements ADD COLUMN IF NOT EXISTS term text;

-- Ensure term exists for attendance (assuming there is an attendance table)
-- wait, let's just do it dynamically or explicitly?
-- Actually, let's just add it explicitly. I don't know if attendance is 'attendance' or 'student_attendance'
-- We saw earlier: 'attendance' is not explicitly listed in my check schema, but maybe it exists.
-- Let's stick to known tables.

ALTER TABLE public.teacher_student_grades ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.teacher_student_grades ADD COLUMN IF NOT EXISTS term text;

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS term text;

ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS term text;

ALTER TABLE public.assignments_activity ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.assignments_activity ADD COLUMN IF NOT EXISTS term text;

ALTER TABLE public.teacher_assessment_grades ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.teacher_assessment_grades ADD COLUMN IF NOT EXISTS term text;

-- Default current values
DO $$
DECLARE
    active_year text := '2026-2027';
    active_quarter text := '1st Quarter';
BEGIN
    SELECT current_school_year, current_quarter INTO active_year, active_quarter FROM public.academic_settings WHERE id = 1;

    IF active_year IS NULL THEN active_year := '2026-2027'; END IF;
    IF active_quarter IS NULL THEN active_quarter := '1st Quarter'; END IF;

    -- lessons
    UPDATE public.lessons SET school_year = active_year WHERE school_year IS NULL;
    UPDATE public.lessons SET term = active_quarter WHERE term IS NULL;

    -- class_materials
    UPDATE public.class_materials SET school_year = active_year WHERE school_year IS NULL;
    UPDATE public.class_materials SET term = active_quarter WHERE term IS NULL;

    -- class_announcements
    UPDATE public.class_announcements SET school_year = active_year WHERE school_year IS NULL;
    UPDATE public.class_announcements SET term = active_quarter WHERE term IS NULL;

    -- teacher_student_grades
    UPDATE public.teacher_student_grades SET school_year = active_year WHERE school_year IS NULL;
    UPDATE public.teacher_student_grades SET term = active_quarter WHERE term IS NULL;

    -- assignments
    UPDATE public.assignments SET school_year = active_year WHERE school_year IS NULL;
    UPDATE public.assignments SET term = active_quarter WHERE term IS NULL;

    -- quizzes
    UPDATE public.quizzes SET school_year = active_year WHERE school_year IS NULL;
    UPDATE public.quizzes SET term = active_quarter WHERE term IS NULL;

    -- assignments_activity
    UPDATE public.assignments_activity SET school_year = active_year WHERE school_year IS NULL;
    UPDATE public.assignments_activity SET term = active_quarter WHERE term IS NULL;

    -- teacher_assessment_grades
    UPDATE public.teacher_assessment_grades SET school_year = active_year WHERE school_year IS NULL;
    UPDATE public.teacher_assessment_grades SET term = active_quarter WHERE term IS NULL;
END $$;

notify pgrst, 'reload schema';
