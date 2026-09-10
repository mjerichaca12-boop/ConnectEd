-- 20260910000002_enhance_assignment_and_material_notifications.sql
-- Comprehensive notification triggers, RLS policies, and realtime sync for assignments, quizzes, materials, and lessons

-- 1. Ensure columns exist on notifications table
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS class_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 2. Ensure class_materials table and columns exist
CREATE TABLE IF NOT EXISTS public.class_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid,
  title text,
  description text,
  file_type text,
  file_url text,
  file_name text,
  file_path text,
  subject text,
  section text,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  school_year text,
  term text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS subject_id uuid;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS file_type text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS school_year text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS term text;
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- 3. Configure RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Notifications are viewable by everyone." ON public.notifications;
DROP POLICY IF EXISTS "anon_delete_notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications." ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications." ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications." ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications." ON public.notifications;

CREATE POLICY "Users can view their own notifications."
  ON public.notifications
  FOR SELECT
  TO authenticated, anon
  USING (
    user_id = auth.uid() 
    OR user_id::text = (
      SELECT id::text FROM public.profiles 
      WHERE email = auth.email() OR id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "System can insert notifications."
  ON public.notifications
  FOR INSERT
  TO authenticated, anon, service_role
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications."
  ON public.notifications
  FOR UPDATE
  TO authenticated, anon
  USING (
    user_id = auth.uid() 
    OR user_id::text = (
      SELECT id::text FROM public.profiles 
      WHERE email = auth.email() OR id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY "Users can delete their own notifications."
  ON public.notifications
  FOR DELETE
  TO authenticated, anon
  USING (
    user_id = auth.uid() 
    OR user_id::text = (
      SELECT id::text FROM public.profiles 
      WHERE email = auth.email() OR id = auth.uid() LIMIT 1
    )
  );

-- 4. Configure RLS on class_materials table
ALTER TABLE public.class_materials ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_materials TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Materials are viewable by everyone" ON public.class_materials;
CREATE POLICY "Materials are viewable by everyone"
  ON public.class_materials
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Teachers can insert class materials" ON public.class_materials;
CREATE POLICY "Teachers can insert class materials"
  ON public.class_materials
  FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Teachers can update class materials" ON public.class_materials;
CREATE POLICY "Teachers can update class materials"
  ON public.class_materials
  FOR UPDATE
  TO public
  USING (true);

DROP POLICY IF EXISTS "Teachers can delete class materials" ON public.class_materials;
CREATE POLICY "Teachers can delete class materials"
  ON public.class_materials
  FOR DELETE
  TO public
  USING (true);

-- 5. Trigger Function: handle_assignment_activity_created_notification (assignments_activity)
CREATE OR REPLACE FUNCTION public.handle_assignment_activity_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_course_id uuid;
  v_type_label text;
  v_notif_type text;
BEGIN
  v_course_id := NEW.course_id;
  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If status column exists and is Draft or Scheduled, do not notify yet
  IF lower(COALESCE(NEW.status, 'published')) IN ('draft', 'scheduled', 'archived') THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only notify if transitioning from Draft/Scheduled to Published
  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.status, 'published')) = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = v_course_id;
  
  IF lower(COALESCE(NEW.assessment_type, '')) LIKE '%quiz%' THEN
    v_type_label := 'Quiz';
    v_notif_type := 'quiz';
  ELSIF lower(COALESCE(NEW.assessment_type, '')) LIKE '%activity%' THEN
    v_type_label := 'Activity';
    v_notif_type := 'assignment';
  ELSE
    v_type_label := 'Assignment';
    v_notif_type := 'assignment';
  END IF;

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    target_student.student_id,
    'New ' || v_type_label || ': ' || NEW.title,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.deadline IS NOT NULL THEN 'Due: ' || to_char(NEW.deadline, 'Mon DD, YYYY') WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New coursework posted' END,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.deadline IS NOT NULL THEN 'Due: ' || to_char(NEW.deadline, 'Mon DD, YYYY') WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New coursework posted' END,
    v_notif_type,
    NEW.id::text,
    'assignments_activity',
    v_course_id,
    false,
    NOW()
  FROM (
    SELECT tsa.student_id
    FROM public.teacher_student_assignments tsa
    WHERE tsa.subject_id = v_course_id
      AND tsa.student_id IS NOT NULL
      AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT e.student_id
    FROM public.enrollments e
    WHERE e.subject_id = v_course_id
      AND e.student_id IS NOT NULL
      AND COALESCE(lower(e.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT p.id AS student_id
    FROM public.profiles p
    JOIN public.subjects s ON s.id = v_course_id
    WHERE lower(COALESCE(p.role, '')) = 'student'
      AND p.id IS NOT NULL
      AND p.section IS NOT NULL
      AND TRIM(LOWER(p.section)) = TRIM(LOWER(s.section))
  ) target_student
  WHERE target_student.student_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = target_student.student_id AND n.related_id = NEW.id::text AND n.type IN ('assignment', 'quiz', 'activity')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_assignment_activity_created_notification ON public.assignments_activity;
CREATE TRIGGER trg_assignment_activity_created_notification
  AFTER INSERT OR UPDATE ON public.assignments_activity
  FOR EACH ROW EXECUTE FUNCTION public.handle_assignment_activity_created_notification();

-- 6. Trigger Function: handle_lesson_assignment_created_notification (assignments)
CREATE OR REPLACE FUNCTION public.handle_lesson_assignment_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_subject_id uuid;
  v_lesson_status text;
  v_type_label text;
BEGIN
  IF NEW.lesson_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if lesson is published
  SELECT subject_id, status INTO v_subject_id, v_lesson_status FROM public.lessons WHERE id = NEW.lesson_id;
  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If status column exists on assignment and is Draft/Scheduled, wait
  IF lower(COALESCE(NEW.status, 'published')) IN ('draft', 'scheduled', 'archived') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.status, 'published')) = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = v_subject_id;
  v_type_label := COALESCE(NULLIF(NEW.assignment_type, ''), 'Assignment');

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    target_student.student_id,
    'New ' || v_type_label || ': ' || NEW.title,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New assignment posted' END,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New assignment posted' END,
    'assignment',
    NEW.id::text,
    'assignments',
    v_subject_id,
    false,
    NOW()
  FROM (
    SELECT tsa.student_id
    FROM public.teacher_student_assignments tsa
    WHERE tsa.subject_id = v_subject_id
      AND tsa.student_id IS NOT NULL
      AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT e.student_id
    FROM public.enrollments e
    WHERE e.subject_id = v_subject_id
      AND e.student_id IS NOT NULL
      AND COALESCE(lower(e.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT p.id AS student_id
    FROM public.profiles p
    JOIN public.subjects s ON s.id = v_subject_id
    WHERE lower(COALESCE(p.role, '')) = 'student'
      AND p.id IS NOT NULL
      AND p.section IS NOT NULL
      AND TRIM(LOWER(p.section)) = TRIM(LOWER(s.section))
  ) target_student
  WHERE target_student.student_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = target_student.student_id AND n.related_id = NEW.id::text AND n.type IN ('assignment', 'activity')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lesson_assignment_created_notification ON public.assignments;
CREATE TRIGGER trg_lesson_assignment_created_notification
  AFTER INSERT OR UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_lesson_assignment_created_notification();

-- 7. Trigger Function: handle_quiz_created_notification (quizzes)
CREATE OR REPLACE FUNCTION public.handle_quiz_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_subject_id uuid;
BEGIN
  -- Resolve subject_id directly or through lessons
  IF NEW.lesson_id IS NOT NULL THEN
    SELECT subject_id INTO v_subject_id FROM public.lessons WHERE id = NEW.lesson_id;
  END IF;

  IF v_subject_id IS NULL THEN
    -- Check if quizzes table has subject_id or course_id
    BEGIN
      v_subject_id := COALESCE(NEW.subject_id, NEW.course_id);
    EXCEPTION WHEN OTHERS THEN
      v_subject_id := NULL;
    END;
  END IF;

  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(NEW.status, 'published')) IN ('draft', 'scheduled', 'archived') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.status, 'published')) = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = v_subject_id;

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    target_student.student_id,
    'New Quiz: ' || NEW.title,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New quiz posted' END,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New quiz posted' END,
    'quiz',
    NEW.id::text,
    'quizzes',
    v_subject_id,
    false,
    NOW()
  FROM (
    SELECT tsa.student_id
    FROM public.teacher_student_assignments tsa
    WHERE tsa.subject_id = v_subject_id
      AND tsa.student_id IS NOT NULL
      AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT e.student_id
    FROM public.enrollments e
    WHERE e.subject_id = v_subject_id
      AND e.student_id IS NOT NULL
      AND COALESCE(lower(e.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT p.id AS student_id
    FROM public.profiles p
    JOIN public.subjects s ON s.id = v_subject_id
    WHERE lower(COALESCE(p.role, '')) = 'student'
      AND p.id IS NOT NULL
      AND p.section IS NOT NULL
      AND TRIM(LOWER(p.section)) = TRIM(LOWER(s.section))
  ) target_student
  WHERE target_student.student_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = target_student.student_id AND n.related_id = NEW.id::text AND n.type = 'quiz'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_quiz_created_notification ON public.quizzes;
CREATE TRIGGER trg_quiz_created_notification
  AFTER INSERT OR UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.handle_quiz_created_notification();

-- 8. Trigger Function: handle_material_created_notification (class_materials)
CREATE OR REPLACE FUNCTION public.handle_material_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_subject_id uuid;
  v_mat_title text;
  v_section text;
BEGIN
  v_subject_id := NEW.subject_id;
  v_section := NEW.section;

  -- If subject_id is null, attempt to resolve from subject string and teacher_id
  IF v_subject_id IS NULL AND NEW.subject IS NOT NULL THEN
    SELECT s.id, s.name, s.section INTO v_subject_id, v_subject_name, v_section
    FROM public.subjects s
    WHERE (s.code ILIKE '%' || TRIM(NEW.subject) || '%' OR s.name ILIKE '%' || TRIM(NEW.subject) || '%' OR (s.code || ' - ' || s.name) ILIKE '%' || TRIM(NEW.subject) || '%')
      AND (NEW.teacher_id IS NULL OR s.teacher_id = NEW.teacher_id)
      AND (NEW.section IS NULL OR TRIM(LOWER(s.section)) = TRIM(LOWER(NEW.section)))
    LIMIT 1;
  ELSIF v_subject_id IS NOT NULL THEN
    SELECT s.name, s.section INTO v_subject_name, v_section FROM public.subjects s WHERE s.id = v_subject_id;
  END IF;

  v_mat_title := COALESCE(NULLIF(NEW.title, ''), NULLIF(NEW.file_name, ''), 'Learning Material');

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    target_student.student_id,
    'New Material: ' || v_mat_title,
    COALESCE(v_subject_name, 'Your class') || ' • ' || COALESCE(NEW.description, 'New learning material uploaded'),
    COALESCE(v_subject_name, 'Your class') || ' • ' || COALESCE(NEW.description, 'New learning material uploaded'),
    'material',
    NEW.id::text,
    'class_materials',
    v_subject_id,
    false,
    NOW()
  FROM (
    SELECT tsa.student_id
    FROM public.teacher_student_assignments tsa
    WHERE (v_subject_id IS NOT NULL AND tsa.subject_id = v_subject_id)
      AND tsa.student_id IS NOT NULL
      AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT e.student_id
    FROM public.enrollments e
    WHERE (v_subject_id IS NOT NULL AND e.subject_id = v_subject_id)
      AND e.student_id IS NOT NULL
      AND COALESCE(lower(e.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT p.id AS student_id
    FROM public.profiles p
    WHERE lower(COALESCE(p.role, '')) = 'student'
      AND p.id IS NOT NULL
      AND (
        (v_section IS NOT NULL AND TRIM(LOWER(p.section)) = TRIM(LOWER(v_section)))
        OR (v_subject_id IS NOT NULL AND p.section IS NOT NULL AND TRIM(LOWER(p.section)) = (SELECT TRIM(LOWER(s.section)) FROM public.subjects s WHERE s.id = v_subject_id))
      )
  ) target_student
  WHERE target_student.student_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = target_student.student_id AND n.related_id = NEW.id::text AND n.type IN ('material', 'materials')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_class_material_created_notification ON public.class_materials;
CREATE TRIGGER trg_class_material_created_notification
  AFTER INSERT OR UPDATE ON public.class_materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_material_created_notification();

-- 9. Trigger Function: handle_lesson_material_created_notification (lesson_materials)
CREATE OR REPLACE FUNCTION public.handle_lesson_material_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_subject_id uuid;
  v_mat_title text;
BEGIN
  IF NEW.lesson_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subject_id INTO v_subject_id FROM public.lessons WHERE id = NEW.lesson_id;
  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = v_subject_id;
  v_mat_title := COALESCE(NULLIF(NEW.file_name, ''), 'Learning Material');

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    target_student.student_id,
    'New Material: ' || v_mat_title,
    COALESCE(v_subject_name, 'Your class') || ' • New lesson material uploaded',
    COALESCE(v_subject_name, 'Your class') || ' • New lesson material uploaded',
    'material',
    NEW.id::text,
    'lesson_materials',
    v_subject_id,
    false,
    NOW()
  FROM (
    SELECT tsa.student_id
    FROM public.teacher_student_assignments tsa
    WHERE tsa.subject_id = v_subject_id
      AND tsa.student_id IS NOT NULL
      AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT e.student_id
    FROM public.enrollments e
    WHERE e.subject_id = v_subject_id
      AND e.student_id IS NOT NULL
      AND COALESCE(lower(e.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT p.id AS student_id
    FROM public.profiles p
    JOIN public.subjects s ON s.id = v_subject_id
    WHERE lower(COALESCE(p.role, '')) = 'student'
      AND p.id IS NOT NULL
      AND p.section IS NOT NULL
      AND TRIM(LOWER(p.section)) = TRIM(LOWER(s.section))
  ) target_student
  WHERE target_student.student_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = target_student.student_id AND n.related_id = NEW.id::text AND n.type IN ('material', 'materials')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lesson_material_created_notification ON public.lesson_materials;
CREATE TRIGGER trg_lesson_material_created_notification
  AFTER INSERT OR UPDATE ON public.lesson_materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_lesson_material_created_notification();

-- 10. Trigger Function: handle_lesson_published_notification (lessons)
CREATE OR REPLACE FUNCTION public.handle_lesson_published_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
BEGIN
  IF NEW.subject_id IS NULL OR lower(COALESCE(NEW.status, '')) <> 'published' THEN
    RETURN NEW;
  END IF;

  -- Only trigger if newly published
  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.status, '')) = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.subject_id;

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    target_student.student_id,
    'New Lesson: ' || NEW.title,
    COALESCE(v_subject_name, 'Your class') || ' • ' || COALESCE(NEW.topic, 'New lesson published'),
    COALESCE(v_subject_name, 'Your class') || ' • ' || COALESCE(NEW.topic, 'New lesson published'),
    'lesson',
    NEW.id::text,
    'lessons',
    NEW.subject_id,
    false,
    NOW()
  FROM (
    SELECT tsa.student_id
    FROM public.teacher_student_assignments tsa
    WHERE tsa.subject_id = NEW.subject_id
      AND tsa.student_id IS NOT NULL
      AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT e.student_id
    FROM public.enrollments e
    WHERE e.subject_id = NEW.subject_id
      AND e.student_id IS NOT NULL
      AND COALESCE(lower(e.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT p.id AS student_id
    FROM public.profiles p
    JOIN public.subjects s ON s.id = NEW.subject_id
    WHERE lower(COALESCE(p.role, '')) = 'student'
      AND p.id IS NOT NULL
      AND p.section IS NOT NULL
      AND TRIM(LOWER(p.section)) = TRIM(LOWER(s.section))
  ) target_student
  WHERE target_student.student_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = target_student.student_id AND n.related_id = NEW.id::text AND n.type IN ('lesson', 'lessons')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lesson_published_notification ON public.lessons;
CREATE TRIGGER trg_lesson_published_notification
  AFTER INSERT OR UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.handle_lesson_published_notification();

-- 11. Trigger Function: handle_class_announcement_created (class_announcements)
CREATE OR REPLACE FUNCTION public.handle_class_announcement_created()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
BEGIN
  IF NEW.class_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF lower(COALESCE(NEW.status, 'published')) IN ('draft', 'scheduled', 'archived') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.status, 'published')) = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.class_id;

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    target_student.student_id,
    'New Class Announcement: ' || NEW.title,
    COALESCE(left(NEW.content, 100), 'New announcement posted in ' || COALESCE(v_subject_name, 'class') || '.'),
    COALESCE(left(NEW.content, 100), 'New announcement posted in ' || COALESCE(v_subject_name, 'class') || '.'),
    'class_announcement',
    NEW.id::text,
    'class_announcements',
    NEW.class_id,
    false,
    NOW()
  FROM (
    SELECT tsa.student_id
    FROM public.teacher_student_assignments tsa
    WHERE tsa.subject_id = NEW.class_id
      AND tsa.student_id IS NOT NULL
      AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT e.student_id
    FROM public.enrollments e
    WHERE e.subject_id = NEW.class_id
      AND e.student_id IS NOT NULL
      AND COALESCE(lower(e.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    UNION
    SELECT p.id AS student_id
    FROM public.profiles p
    JOIN public.subjects s ON s.id = NEW.class_id
    WHERE lower(COALESCE(p.role, '')) = 'student'
      AND p.id IS NOT NULL
      AND p.section IS NOT NULL
      AND TRIM(LOWER(p.section)) = TRIM(LOWER(s.section))
  ) target_student
  WHERE target_student.student_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = target_student.student_id AND n.related_id = NEW.id::text AND n.type IN ('announcement', 'class_announcement')
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_class_announcement_created ON public.class_announcements;
CREATE TRIGGER trg_class_announcement_created
  AFTER INSERT OR UPDATE ON public.class_announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_class_announcement_created();

-- 12. Configure Replica Identity & Realtime Publication for all coursework & materials
ALTER TABLE public.lessons REPLICA IDENTITY FULL;
ALTER TABLE public.assignments_activity REPLICA IDENTITY FULL;
ALTER TABLE public.assignments REPLICA IDENTITY FULL;
ALTER TABLE public.quizzes REPLICA IDENTITY FULL;
ALTER TABLE public.class_materials REPLICA IDENTITY FULL;
ALTER TABLE public.lesson_materials REPLICA IDENTITY FULL;
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
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'class_materials') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_materials;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lesson_materials') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lesson_materials;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'class_announcements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_announcements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- 13. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
