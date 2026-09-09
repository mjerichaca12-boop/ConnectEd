-- 20260909000003_add_assignment_and_material_notification_triggers.sql
-- Create class_materials table if missing & set up comprehensive notification triggers

-- 1. Ensure class_materials table exists
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
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure all columns exist on class_materials
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
ALTER TABLE public.class_materials ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Enable RLS and set policies
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

-- 2. Trigger Function for assignments_activity (Course/Class Level)
CREATE OR REPLACE FUNCTION public.handle_assignment_activity_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_course_id uuid;
  v_type_label text;
BEGIN
  v_course_id := NEW.course_id;
  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = v_course_id;
  v_type_label := CASE WHEN lower(COALESCE(NEW.assessment_type, '')) = 'activity' THEN 'Activity' ELSE 'Assignment' END;

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    tsa.student_id,
    'New ' || v_type_label || ': ' || NEW.title,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.deadline IS NOT NULL THEN 'Due: ' || to_char(NEW.deadline, 'Mon DD, YYYY') ELSE 'New activity posted' END,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.deadline IS NOT NULL THEN 'Due: ' || to_char(NEW.deadline, 'Mon DD, YYYY') ELSE 'New activity posted' END,
    'assignment',
    NEW.id::text,
    'assignments_activity',
    v_course_id,
    false,
    NOW()
  FROM public.teacher_student_assignments tsa
  WHERE tsa.subject_id = v_course_id
    AND tsa.student_id IS NOT NULL
    AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = tsa.student_id AND n.related_id = NEW.id::text AND n.type = 'assignment'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_assignment_activity_created_notification ON public.assignments_activity;
CREATE TRIGGER trg_assignment_activity_created_notification
  AFTER INSERT ON public.assignments_activity
  FOR EACH ROW EXECUTE FUNCTION public.handle_assignment_activity_created_notification();

-- 3. Trigger Function for assignments (Lesson Level)
CREATE OR REPLACE FUNCTION public.handle_lesson_assignment_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_subject_id uuid;
  v_type_label text;
BEGIN
  IF NEW.lesson_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subject_id INTO v_subject_id FROM public.lessons WHERE id = NEW.lesson_id;
  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = v_subject_id;
  v_type_label := COALESCE(NULLIF(NEW.assignment_type, ''), 'Assignment');

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    tsa.student_id,
    'New ' || v_type_label || ': ' || NEW.title,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New assignment posted' END,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New assignment posted' END,
    'assignment',
    NEW.id::text,
    'assignments',
    v_subject_id,
    false,
    NOW()
  FROM public.teacher_student_assignments tsa
  WHERE tsa.subject_id = v_subject_id
    AND tsa.student_id IS NOT NULL
    AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = tsa.student_id AND n.related_id = NEW.id::text AND n.type = 'assignment'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lesson_assignment_created_notification ON public.assignments;
CREATE TRIGGER trg_lesson_assignment_created_notification
  AFTER INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_lesson_assignment_created_notification();

-- 4. Trigger Function for Quizzes
CREATE OR REPLACE FUNCTION public.handle_quiz_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_subject_id uuid;
BEGIN
  IF NEW.lesson_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subject_id INTO v_subject_id FROM public.lessons WHERE id = NEW.lesson_id;
  IF v_subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = v_subject_id;

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    tsa.student_id,
    'New Quiz: ' || NEW.title,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New quiz posted' END,
    COALESCE(v_subject_name, 'Your class') || ' • ' || CASE WHEN NEW.due_date IS NOT NULL THEN 'Due: ' || to_char(NEW.due_date, 'Mon DD, YYYY') ELSE 'New quiz posted' END,
    'quiz',
    NEW.id::text,
    'quizzes',
    v_subject_id,
    false,
    NOW()
  FROM public.teacher_student_assignments tsa
  WHERE tsa.subject_id = v_subject_id
    AND tsa.student_id IS NOT NULL
    AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = tsa.student_id AND n.related_id = NEW.id::text AND n.type = 'quiz'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_quiz_created_notification ON public.quizzes;
CREATE TRIGGER trg_quiz_created_notification
  AFTER INSERT ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.handle_quiz_created_notification();

-- 5. Trigger Function for Class Materials
CREATE OR REPLACE FUNCTION public.handle_material_created_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
  v_mat_title text;
BEGIN
  IF NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.subject_id;
  v_mat_title := COALESCE(NULLIF(NEW.title, ''), NULLIF(NEW.file_name, ''), 'Learning Material');

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    tsa.student_id,
    'New Material: ' || v_mat_title,
    COALESCE(v_subject_name, 'Your class') || ' • New learning material uploaded',
    COALESCE(v_subject_name, 'Your class') || ' • New learning material uploaded',
    'material',
    NEW.id::text,
    'class_materials',
    NEW.subject_id,
    false,
    NOW()
  FROM public.teacher_student_assignments tsa
  WHERE tsa.subject_id = NEW.subject_id
    AND tsa.student_id IS NOT NULL
    AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = tsa.student_id AND n.related_id = NEW.id::text AND n.type = 'material'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_class_material_created_notification ON public.class_materials;
CREATE TRIGGER trg_class_material_created_notification
  AFTER INSERT ON public.class_materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_material_created_notification();

-- 6. Trigger Function for Lesson Materials
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
    tsa.student_id,
    'New Material: ' || v_mat_title,
    COALESCE(v_subject_name, 'Your class') || ' • New lesson material uploaded',
    COALESCE(v_subject_name, 'Your class') || ' • New lesson material uploaded',
    'material',
    NEW.id::text,
    'lesson_materials',
    v_subject_id,
    false,
    NOW()
  FROM public.teacher_student_assignments tsa
  WHERE tsa.subject_id = v_subject_id
    AND tsa.student_id IS NOT NULL
    AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = tsa.student_id AND n.related_id = NEW.id::text AND n.type = 'material'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lesson_material_created_notification ON public.lesson_materials;
CREATE TRIGGER trg_lesson_material_created_notification
  AFTER INSERT ON public.lesson_materials
  FOR EACH ROW EXECUTE FUNCTION public.handle_lesson_material_created_notification();

-- 7. Trigger Function for Lessons Published
CREATE OR REPLACE FUNCTION public.handle_lesson_published_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
BEGIN
  IF NEW.subject_id IS NULL OR lower(COALESCE(NEW.status, '')) <> 'published' THEN
    RETURN NEW;
  END IF;

  -- Only trigger if newly published (on insert or status transition)
  IF TG_OP = 'UPDATE' AND lower(COALESCE(OLD.status, '')) = 'published' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.subject_id;

  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, class_id, is_read, created_at)
  SELECT DISTINCT
    tsa.student_id,
    'New Lesson: ' || NEW.title,
    COALESCE(v_subject_name, 'Your class') || ' • New lesson published',
    COALESCE(v_subject_name, 'Your class') || ' • New lesson published',
    'lesson',
    NEW.id::text,
    'lessons',
    NEW.subject_id,
    false,
    NOW()
  FROM public.teacher_student_assignments tsa
  WHERE tsa.subject_id = NEW.subject_id
    AND tsa.student_id IS NOT NULL
    AND COALESCE(lower(tsa.status), '') NOT IN ('rejected', 'dropped', 'inactive')
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = tsa.student_id AND n.related_id = NEW.id::text AND n.type = 'lesson'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lesson_published_notification ON public.lessons;
CREATE TRIGGER trg_lesson_published_notification
  AFTER INSERT OR UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.handle_lesson_published_notification();

-- 8. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

