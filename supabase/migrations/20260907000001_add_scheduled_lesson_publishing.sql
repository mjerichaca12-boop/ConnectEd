-- 20260907000001_add_scheduled_lesson_publishing.sql
-- Add scheduled_publish_at and published_at columns to lessons table
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Helper function to check if a lesson is currently visible to students
CREATE OR REPLACE FUNCTION public.is_lesson_visible_to_students(lesson_row public.lessons)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    lesson_row.status = 'Published'
    OR (
      lesson_row.status = 'Scheduled'
      AND lesson_row.scheduled_publish_at IS NOT NULL
      AND lesson_row.scheduled_publish_at <= NOW()
    )
  );
$$;

-- Update RPC function public.get_my_assignments_activity() to filter out activities/assignments attached to scheduled/draft lessons before publication time
CREATE OR REPLACE FUNCTION public.get_my_assignments_activity()
RETURNS TABLE (
  id uuid,
  course_id uuid,
  title text,
  description text,
  due_date timestamptz,
  deadline timestamptz,
  dueDate timestamptz,
  file_url text,
  file_name text,
  file_path text,
  assessment_type text,
  type text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    a.id,
    l.subject_id AS course_id,
    a.title,
    a.description,
    a.due_date,
    a.due_date AS deadline,
    a.due_date AS dueDate,
    a.attachment_url AS file_url,
    a.attachment_name AS file_name,
    NULL::text AS file_path,
    a.assignment_type AS assessment_type,
    a.assignment_type AS type,
    a.created_at
  FROM public.assignments a
  JOIN public.lessons l ON a.lesson_id = l.id
  WHERE l.status = 'Published'
     OR (l.status = 'Scheduled' AND l.scheduled_publish_at IS NOT NULL AND l.scheduled_publish_at <= NOW());
$$;

GRANT EXECUTE ON FUNCTION public.get_my_assignments_activity() TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
