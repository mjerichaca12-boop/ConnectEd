-- Migration: Create bulk_delete_students RPC function
-- Date: 2026-09-04

CREATE OR REPLACE FUNCTION public.bulk_delete_students(p_student_ids uuid[])
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_student_ids IS NULL OR array_length(p_student_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  v_count := array_length(p_student_ids, 1);

  -- 1. Batch delete all related student records
  DELETE FROM public.notifications WHERE user_id = ANY(p_student_ids);
  DELETE FROM public.password_reset_logs WHERE user_id = ANY(p_student_ids);
  DELETE FROM public.conversation_participants WHERE profile_id = ANY(p_student_ids);
  DELETE FROM public.conversation_reads WHERE user_id = ANY(p_student_ids);
  DELETE FROM public.messages WHERE sender_id = ANY(p_student_ids) OR receiver_id = ANY(p_student_ids);
  DELETE FROM public.teacher_student_assignments WHERE student_id = ANY(p_student_ids);
  DELETE FROM public.teacher_student_grades WHERE student_id = ANY(p_student_ids);
  DELETE FROM public.teacher_assessment_submissions WHERE student_id = ANY(p_student_ids);
  DELETE FROM public.teacher_assessment_grades WHERE student_id = ANY(p_student_ids);
  DELETE FROM public.student_attendance WHERE student_id = ANY(p_student_ids);

  -- 2. Batch delete student profiles
  DELETE FROM public.profiles WHERE id = ANY(p_student_ids) AND role = 'student';

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.bulk_delete_students(uuid[]) TO anon, authenticated, service_role;
