-- 20260907000002_fix_scheduled_publishing_system.sql
-- Comprehensive Server-Side Scheduled Publishing & Realtime Sync System

-- 1. Ensure columns exist across all content tables
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS status text DEFAULT 'Draft';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.assignments_activity ADD COLUMN IF NOT EXISTS status text DEFAULT 'Published';
ALTER TABLE public.assignments_activity ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
ALTER TABLE public.assignments_activity ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS status text DEFAULT 'Published';
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS status text DEFAULT 'Published';
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.class_announcements ADD COLUMN IF NOT EXISTS status text DEFAULT 'Published';
ALTER TABLE public.class_announcements ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
ALTER TABLE public.class_announcements ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- 2. Update status check constraints
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_status_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_status_check CHECK (status IN ('Draft', 'Scheduled', 'Published', 'Archived'));

ALTER TABLE public.assignments_activity DROP CONSTRAINT IF EXISTS assignments_activity_status_check;
ALTER TABLE public.assignments_activity ADD CONSTRAINT assignments_activity_status_check CHECK (status IN ('Draft', 'Scheduled', 'Published', 'Archived'));

ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_status_check CHECK (status IN ('Draft', 'Scheduled', 'Published', 'Archived'));

ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_status_check;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_status_check CHECK (status IN ('Draft', 'Scheduled', 'Published', 'Archived'));

ALTER TABLE public.class_announcements DROP CONSTRAINT IF EXISTS class_announcements_status_check;
ALTER TABLE public.class_announcements ADD CONSTRAINT class_announcements_status_check CHECK (status IN ('Draft', 'Scheduled', 'Published', 'Archived'));

-- 3. Configure Realtime Replica Identity & Add Tables to Publication
ALTER TABLE public.lessons REPLICA IDENTITY FULL;
ALTER TABLE public.assignments_activity REPLICA IDENTITY FULL;
ALTER TABLE public.assignments REPLICA IDENTITY FULL;
ALTER TABLE public.quizzes REPLICA IDENTITY FULL;
ALTER TABLE public.class_announcements REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lessons') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lessons;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assignments_activity') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments_activity;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'assignments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quizzes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'class_announcements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_announcements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 4. Centralized Server-Side Publisher Function
CREATE OR REPLACE FUNCTION public.process_scheduled_publishing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  -- A. Process Scheduled Lessons
  FOR rec IN
    SELECT l.id, l.title, l.subject_id, l.teacher_id
    FROM public.lessons l
    WHERE l.status = 'Scheduled'
      AND l.scheduled_publish_at IS NOT NULL
      AND l.scheduled_publish_at <= NOW()
  LOOP
    UPDATE public.lessons
    SET status = 'Published', published_at = NOW(), scheduled_publish_at = NULL
    WHERE id = rec.id;

    INSERT INTO public.notifications (user_id, type, title, body, message, related_id, related_type, class_id, is_read, created_at)
    SELECT DISTINCT
      tsa.student_id,
      'lesson',
      'New Lesson Available: ' || rec.title,
      'A new lesson "' || rec.title || '" has been published for your class.',
      'A new lesson "' || rec.title || '" has been published for your class.',
      rec.id::text,
      'lessons',
      rec.subject_id,
      false,
      NOW()
    FROM public.teacher_student_assignments tsa
    WHERE tsa.subject_id = rec.subject_id
      AND tsa.student_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = tsa.student_id AND n.related_id = rec.id::text AND n.type = 'lesson'
      );
  END LOOP;

  -- B. Process Scheduled Assignments (assignments_activity)
  FOR rec IN
    SELECT a.id, a.title, a.course_id
    FROM public.assignments_activity a
    WHERE a.status = 'Scheduled'
      AND a.scheduled_publish_at IS NOT NULL
      AND a.scheduled_publish_at <= NOW()
  LOOP
    UPDATE public.assignments_activity
    SET status = 'Published', published_at = NOW(), scheduled_publish_at = NULL
    WHERE id = rec.id;

    IF rec.course_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, message, related_id, related_type, class_id, is_read, created_at)
      SELECT DISTINCT
        tsa.student_id,
        'assignment',
        'New Assignment: ' || rec.title,
        'A new assignment "' || rec.title || '" has been posted for your class.',
        'A new assignment "' || rec.title || '" has been posted for your class.',
        rec.id::text,
        'assignments_activity',
        rec.course_id,
        false,
        NOW()
      FROM public.teacher_student_assignments tsa
      WHERE tsa.subject_id = rec.course_id
        AND tsa.student_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = tsa.student_id AND n.related_id = rec.id::text AND n.type = 'assignment'
        );
    END IF;
  END LOOP;

  -- C. Process Scheduled Quizzes
  FOR rec IN
    SELECT q.id, q.title, coalesce(q.course_id, q.subject_id) as subject_id
    FROM public.quizzes q
    WHERE q.status = 'Scheduled'
      AND q.scheduled_publish_at IS NOT NULL
      AND q.scheduled_publish_at <= NOW()
  LOOP
    UPDATE public.quizzes
    SET status = 'Published', published_at = NOW(), scheduled_publish_at = NULL
    WHERE id = rec.id;

    IF rec.subject_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, message, related_id, related_type, class_id, is_read, created_at)
      SELECT DISTINCT
        tsa.student_id,
        'quiz',
        'New Quiz Available: ' || rec.title,
        'A new quiz "' || rec.title || '" has been published for your class.',
        'A new quiz "' || rec.title || '" has been published for your class.',
        rec.id::text,
        'quizzes',
        rec.subject_id,
        false,
        NOW()
      FROM public.teacher_student_assignments tsa
      WHERE tsa.subject_id = rec.subject_id
        AND tsa.student_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = tsa.student_id AND n.related_id = rec.id::text AND n.type = 'quiz'
        );
    END IF;
  END LOOP;

  -- D. Process Scheduled Class Announcements
  FOR rec IN
    SELECT ca.id, ca.title, ca.content, ca.class_id, ca.priority, ca.scheduled_publish_at
    FROM public.class_announcements ca
    WHERE ca.status = 'Scheduled'
       OR ca.priority LIKE '%"status":"Scheduled"%'
  LOOP
    IF (rec.scheduled_publish_at IS NOT NULL AND rec.scheduled_publish_at <= NOW())
       OR (rec.priority LIKE '%"scheduled_at"%' AND (rec.priority::json->>'scheduled_at')::timestamptz <= NOW()) THEN
      UPDATE public.class_announcements
      SET status = 'Published',
          published_at = NOW(),
          scheduled_publish_at = NULL,
          priority = CASE 
            WHEN priority LIKE '%"status":"Scheduled"%' 
            THEN regexp_replace(priority, '"status":"Scheduled"', '"status":"Published"')
            ELSE priority
          END
      WHERE id = rec.id;

      INSERT INTO public.notifications (user_id, type, title, body, message, related_id, related_type, class_id, is_read, created_at)
      SELECT DISTINCT
        tsa.student_id,
        'announcement',
        'New Class Announcement: ' || rec.title,
        coalesce(rec.content, 'A new announcement has been posted for your class.'),
        coalesce(rec.content, 'A new announcement has been posted for your class.'),
        rec.id::text,
        'class_announcements',
        rec.class_id,
        false,
        NOW()
      FROM public.teacher_student_assignments tsa
      WHERE tsa.subject_id = rec.class_id
        AND tsa.student_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.notifications n
          WHERE n.user_id = tsa.student_id AND n.related_id = rec.id::text AND n.type = 'announcement'
        );
    END IF;
  END LOOP;
END;
$$;

-- 5. RPC Wrapper for Client Triggers & Periodic Checks
CREATE OR REPLACE FUNCTION public.check_and_process_scheduled_publishing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM public.process_scheduled_publishing();
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_scheduled_publishing() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_and_process_scheduled_publishing() TO authenticated, anon;

-- 6. Attempt pg_cron Scheduling (if extension enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('process_scheduled_publishing_job', '* * * * *', $$SELECT public.process_scheduled_publishing();$$);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
