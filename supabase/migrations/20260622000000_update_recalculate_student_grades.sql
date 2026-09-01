-- Migration: Update recalculate_student_grades to support 'Returned' status
-- Date: 2026-06-22

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
  WHERE student_id = v_student_id AND subject_id = v_subject_id AND assessment_type = 'quiz' AND status IN ('Graded', 'Returned');

  -- Calculate Assignment Average
  SELECT COALESCE(AVG(grade_value / NULLIF(max_points, 0) * 100), 0)
  INTO v_assignment_avg
  FROM public.teacher_assessment_grades
  WHERE student_id = v_student_id AND subject_id = v_subject_id AND assessment_type = 'assignment' AND status IN ('Graded', 'Returned');

  -- Calculate Activity Average
  SELECT COALESCE(AVG(grade_value / NULLIF(max_points, 0) * 100), 0)
  INTO v_activity_avg
  FROM public.teacher_assessment_grades
  WHERE student_id = v_student_id AND subject_id = v_subject_id AND assessment_type = 'activity' AND status IN ('Graded', 'Returned');

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

  -- Notification Trigger: Send if a grade was updated/inserted to "Graded" or "Returned"
  IF (TG_OP = 'INSERT' AND NEW.status IN ('Graded', 'Returned')) OR 
     (TG_OP = 'UPDATE' AND NEW.status IN ('Graded', 'Returned') AND OLD.status NOT IN ('Graded', 'Returned')) THEN
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

NOTIFY pgrst, 'reload schema';
