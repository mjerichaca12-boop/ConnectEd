-- Migration: Gradebook Automation Triggers
-- Date: 2026-06-21

-- Step 1: Trigger to auto-create gradebook records on submission
CREATE OR REPLACE FUNCTION public.handle_new_assessment_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_points numeric;
  v_title text;
  v_assessment_type text;
BEGIN
  -- Attempt to fetch details from assignments_activity
  -- Handle type casting safely
  BEGIN
    SELECT 100, title, lower(assessment_type) 
    INTO v_max_points, v_title, v_assessment_type
    FROM public.assignments_activity 
    WHERE id::text = NEW.assessment_id;
  EXCEPTION WHEN OTHERS THEN
    -- In case of uuid cast failure or other errors
    v_max_points := 100;
    v_title := 'Assessment';
    v_assessment_type := 'assignment';
  END;

  -- Fallbacks
  IF v_max_points IS NULL THEN v_max_points := 100; END IF;
  IF v_title IS NULL THEN v_title := 'Assessment'; END IF;
  IF v_assessment_type IS NULL THEN v_assessment_type := 'assignment'; END IF;

  -- Insert into teacher_assessment_grades if no record exists
  IF NOT EXISTS (
    SELECT 1 FROM public.teacher_assessment_grades 
    WHERE student_id = NEW.student_id 
    AND assessment_id = NEW.assessment_id
  ) THEN
    INSERT INTO public.teacher_assessment_grades (
      teacher_id, 
      subject_id, 
      assessment_id, 
      assessment_title, 
      assessment_type, 
      max_points, 
      student_id, 
      grade_value, 
      status
    ) VALUES (
      NEW.teacher_id,
      NEW.subject_id,
      NEW.assessment_id,
      v_title,
      v_assessment_type,
      v_max_points,
      NEW.student_id,
      0,
      'Pending'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_new_assessment_submission ON public.teacher_assessment_submissions;
CREATE TRIGGER trg_handle_new_assessment_submission
  AFTER INSERT ON public.teacher_assessment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_assessment_submission();

-- Step 2: Trigger to recalculate overall grades in teacher_student_grades
CREATE OR REPLACE FUNCTION public.recalculate_student_grades()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id uuid;
  v_subject_id uuid;
  v_teacher_id uuid;
  
  v_quiz_avg numeric(5,2) := 0;
  v_assignment_avg numeric(5,2) := 0;
  v_activity_avg numeric(5,2) := 0;
  v_overall numeric(5,2) := 0;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_student_id := OLD.student_id;
    v_subject_id := OLD.subject_id;
    v_teacher_id := OLD.teacher_id;
  ELSE
    v_student_id := NEW.student_id;
    v_subject_id := NEW.subject_id;
    v_teacher_id := NEW.teacher_id;
  END IF;

  -- Calculate Quiz Average
  SELECT COALESCE(AVG(grade_value / NULLIF(max_points, 0) * 100), 0)
  INTO v_quiz_avg
  FROM public.teacher_assessment_grades
  WHERE student_id = v_student_id AND subject_id = v_subject_id AND assessment_type = 'quiz' AND status = 'Graded';

  -- Calculate Assignment Average
  SELECT COALESCE(AVG(grade_value / NULLIF(max_points, 0) * 100), 0)
  INTO v_assignment_avg
  FROM public.teacher_assessment_grades
  WHERE student_id = v_student_id AND subject_id = v_subject_id AND assessment_type = 'assignment' AND status = 'Graded';

  -- Calculate Activity Average
  SELECT COALESCE(AVG(grade_value / NULLIF(max_points, 0) * 100), 0)
  INTO v_activity_avg
  FROM public.teacher_assessment_grades
  WHERE student_id = v_student_id AND subject_id = v_subject_id AND assessment_type = 'activity' AND status = 'Graded';

  -- Calculate Overall Grade (Simple average of the averages)
  v_overall := (v_quiz_avg + v_assignment_avg + v_activity_avg) / 3;

  -- Upsert into teacher_student_grades
  INSERT INTO public.teacher_student_grades (
    teacher_id, subject_id, student_id, quiz_average, assignment_grade, activity_grade, overall_grade, updated_at
  ) VALUES (
    v_teacher_id, v_subject_id, v_student_id, v_quiz_avg, v_assignment_avg, v_activity_avg, v_overall, now()
  )
  ON CONFLICT (teacher_id, subject_id, student_id)
  DO UPDATE SET
    quiz_average = EXCLUDED.quiz_average,
    assignment_grade = EXCLUDED.assignment_grade,
    activity_grade = EXCLUDED.activity_grade,
    overall_grade = EXCLUDED.overall_grade,
    updated_at = EXCLUDED.updated_at;

  -- Notification Trigger: Only send if a grade was updated to "Graded"
  IF TG_OP = 'UPDATE' AND NEW.status = 'Graded' AND OLD.status != 'Graded' THEN
    INSERT INTO public.notifications (user_id, title, body, type, created_at)
    VALUES (
      NEW.student_id,
      'Grade Posted: ' || COALESCE(NEW.assessment_title, 'Assessment'),
      'You received a ' || NEW.grade_value || '/' || NEW.max_points || '.',
      'grade',
      now()
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_student_grades ON public.teacher_assessment_grades;
CREATE TRIGGER trg_recalculate_student_grades
  AFTER INSERT OR UPDATE OR DELETE ON public.teacher_assessment_grades
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_student_grades();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
