-- 20260909000003_add_assignment_and_material_notification_triggers.sql
-- Triggers to automatically notify enrolled students when assignments and materials are created

-- 1. Trigger Function for Assignments / Activities
CREATE OR REPLACE FUNCTION public.handle_assignment_created_notification()
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
    AND tsa.status IN ('Active', 'active', 'accepted', 'approved')
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_assignment_created_notification();

-- 2. Trigger Function for Class Materials
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
    AND tsa.status IN ('Active', 'active', 'accepted', 'approved')
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

-- 3. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
