-- Migration: Complete Notifications System
-- Date: 2026-06-22

-- 1. Table Schema Updates
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_id TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_type TEXT;

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- 2. Enable DELETE RLS policy for anon/authenticated roles on notifications
DROP POLICY IF EXISTS "anon_delete_notifications" ON public.notifications;
CREATE POLICY "anon_delete_notifications"
  ON public.notifications
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- 3. Helper Function to Notify Admins
CREATE OR REPLACE FUNCTION public.notify_admins(
  p_title text,
  p_body text,
  p_related_id text DEFAULT NULL,
  p_related_type text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
  SELECT id, p_title, p_body, p_body, 'system', p_related_id, p_related_type
  FROM public.profiles
  WHERE role = 'admin' AND id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. User Management Trigger Function (Profiles)
CREATE OR REPLACE FUNCTION public.handle_profile_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '');
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IN ('teacher', 'student') THEN
      PERFORM public.notify_admins(
        'New Account Created',
        'A new ' || NEW.role || ' account (' || v_name || ') has been registered.',
        NEW.id::text,
        'profiles'
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Activation/Deactivation check
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status IN ('Disabled', 'Inactive', 'deactivated') THEN
        PERFORM public.notify_admins(
          'Account Deactivated',
          'The ' || NEW.role || ' account (' || v_name || ') has been deactivated.',
          NEW.id::text,
          'profiles'
        );
      ELSIF NEW.status IN ('Active', 'activated', 'Active') THEN
        PERFORM public.notify_admins(
          'Account Activated',
          'The ' || NEW.role || ' account (' || v_name || ') has been activated.',
          NEW.id::text,
          'profiles'
        );
      END IF;
    -- Name, Email, or Role check
    ELSIF OLD.first_name IS DISTINCT FROM NEW.first_name 
       OR OLD.last_name IS DISTINCT FROM NEW.last_name 
       OR OLD.role IS DISTINCT FROM NEW.role 
       OR OLD.email IS DISTINCT FROM NEW.email THEN
      PERFORM public.notify_admins(
        'Account Updated',
        'The ' || NEW.role || ' account (' || v_name || ') details have been updated.',
        NEW.id::text,
        'profiles'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_profile_changes ON public.profiles;
CREATE TRIGGER trg_profile_changes
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_changes();

-- 5. Class Management Trigger Function (Subjects)
CREATE OR REPLACE FUNCTION public.handle_subject_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Notify admins
    PERFORM public.notify_admins(
      'New Class Created',
      'A new class ' || NEW.code || ' - ' || NEW.name || ' has been created.',
      NEW.id::text,
      'subjects'
    );
    -- Notify teacher if assigned
    IF NEW.teacher_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
      VALUES (
        NEW.teacher_id,
        'Class Assignment',
        'You have been assigned as the teacher for ' || NEW.code || ' - ' || NEW.name || '.',
        'You have been assigned as the teacher for ' || NEW.code || ' - ' || NEW.name || '.',
        'assignments',
        NEW.id::text,
        'subjects'
      );
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Teacher assignment changes
    IF OLD.teacher_id IS DISTINCT FROM NEW.teacher_id THEN
      -- Notify new teacher
      IF NEW.teacher_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
        VALUES (
          NEW.teacher_id,
          'Class Assignment',
          'You have been assigned as the teacher for ' || NEW.code || ' - ' || NEW.name || '.',
          'You have been assigned as the teacher for ' || NEW.code || ' - ' || NEW.name || '.',
          'assignments',
          NEW.id::text,
          'subjects'
        );
        -- Notify admins
        PERFORM public.notify_admins(
          'Teacher Assigned to Class',
          'Teacher has been assigned to class ' || NEW.code || ' - ' || NEW.name || '.',
          NEW.id::text,
          'subjects'
        );
      END IF;
      -- Notify old teacher
      IF OLD.teacher_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
        VALUES (
          OLD.teacher_id,
          'Class Unassignment',
          'You have been unassigned from the class ' || NEW.code || ' - ' || NEW.name || '.',
          'You have been unassigned from the class ' || NEW.code || ' - ' || NEW.name || '.',
          'assignments',
          NEW.id::text,
          'subjects'
        );
      END IF;
    END IF;

    -- Status changes (Archive/Restore)
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'Archived' THEN
        -- Notify admins
        PERFORM public.notify_admins(
          'Class Archived',
          'The class ' || NEW.code || ' - ' || NEW.name || ' has been archived.',
          NEW.id::text,
          'subjects'
        );
        -- Notify teacher
        IF NEW.teacher_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
          VALUES (
            NEW.teacher_id,
            'Class Archived',
            'Your class ' || NEW.code || ' - ' || NEW.name || ' has been archived.',
            'Your class ' || NEW.code || ' - ' || NEW.name || ' has been archived.',
            'system',
            NEW.id::text,
            'subjects'
          );
        END IF;
      ELSIF NEW.status = 'Active' AND OLD.status = 'Archived' THEN
        -- Notify admins
        PERFORM public.notify_admins(
          'Class Restored',
          'The class ' || NEW.code || ' - ' || NEW.name || ' has been restored.',
          NEW.id::text,
          'subjects'
        );
        -- Notify teacher
        IF NEW.teacher_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
          VALUES (
            NEW.teacher_id,
            'Class Restored',
            'Your class ' || NEW.code || ' - ' || NEW.name || ' has been restored.',
            'Your class ' || NEW.code || ' - ' || NEW.name || ' has been restored.',
            'system',
            NEW.id::text,
            'subjects'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_subject_changes ON public.subjects;
CREATE TRIGGER trg_subject_changes
  AFTER INSERT OR UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.handle_subject_changes();

-- 6. Class Announcements Trigger Function
CREATE OR REPLACE FUNCTION public.handle_class_announcement_created()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
BEGIN
  SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.class_id;
  
  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
  SELECT student_id, 
         'New Class Announcement: ' || NEW.title, 
         COALESCE(left(NEW.content, 100), 'New announcement posted in ' || COALESCE(v_subject_name, 'class') || '.'),
         COALESCE(left(NEW.content, 100), 'New announcement posted in ' || COALESCE(v_subject_name, 'class') || '.'),
         'announcement', 
         NEW.id::text, 
         'class_announcements'
  FROM public.teacher_student_assignments
  WHERE subject_id = NEW.class_id AND status = 'Active' AND student_id IS NOT NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_class_announcement_created ON public.class_announcements;
CREATE TRIGGER trg_class_announcement_created
  AFTER INSERT ON public.class_announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_class_announcement_created();

-- 7. School Announcements Trigger Function
CREATE OR REPLACE FUNCTION public.handle_school_announcement_created()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_audience = 'School-wide' THEN
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
    SELECT id, 
           'New Announcement: ' || NEW.title, 
           left(NEW.content, 100), 
           left(NEW.content, 100), 
           'announcement', 
           NEW.id::text, 
           'school_announcements'
    FROM public.profiles
    WHERE role IN ('teacher', 'student') AND id IS NOT NULL;
  ELSIF NEW.target_audience = 'Students' THEN
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
    SELECT id, 
           'New Announcement: ' || NEW.title, 
           left(NEW.content, 100), 
           left(NEW.content, 100), 
           'announcement', 
           NEW.id::text, 
           'school_announcements'
    FROM public.profiles
    WHERE role = 'student' AND id IS NOT NULL;
  ELSIF NEW.target_audience = 'Teacher' THEN
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
    SELECT id, 
           'New Announcement: ' || NEW.title, 
           left(NEW.content, 100), 
           left(NEW.content, 100), 
           'announcement', 
           NEW.id::text, 
           'school_announcements'
    FROM public.profiles
    WHERE role = 'teacher' AND id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_announcement_created ON public.school_announcements;
CREATE TRIGGER on_announcement_created
  AFTER INSERT ON public.school_announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_school_announcement_created();

-- 8. School Calendar Events Trigger Function
CREATE OR REPLACE FUNCTION public.handle_school_calendar_event_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
  SELECT id, 
         'New Event: ' || NEW.title, 
         'Date: ' || COALESCE(NEW.event_date::text, 'To be announced'), 
         'Date: ' || COALESCE(NEW.event_date::text, 'To be announced'), 
         'event', 
         NEW.id::text, 
         'school_calendar_events'
  FROM public.profiles
  WHERE id IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_calendar_event_created ON public.school_calendar_events;
CREATE TRIGGER on_calendar_event_created
  AFTER INSERT ON public.school_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.handle_school_calendar_event_created();

-- 9. Assessment Submission Trigger Function
CREATE OR REPLACE FUNCTION public.handle_assessment_submitted()
RETURNS TRIGGER AS $$
DECLARE
  v_student_name text;
  v_assessment_title text;
  v_designation text;
  v_subject_name text;
BEGIN
  SELECT first_name || ' ' || last_name INTO v_student_name FROM public.profiles WHERE id = NEW.student_id;
  SELECT title, designation INTO v_assessment_title, v_designation FROM public.assignments_activity WHERE id::text = NEW.assessment_id LIMIT 1;
  SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.subject_id;
  
  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
  VALUES (
    NEW.teacher_id,
    'New Submission: ' || COALESCE(v_designation, 'Assessment'),
    COALESCE(v_student_name, 'A student') || ' submitted ' || COALESCE(v_assessment_title, 'an assessment') || ' in ' || COALESCE(v_subject_name, 'class') || '.',
    COALESCE(v_student_name, 'A student') || ' submitted ' || COALESCE(v_assessment_title, 'an assessment') || ' in ' || COALESCE(v_subject_name, 'class') || '.',
    'assignments',
    NEW.id::text,
    'teacher_assessment_submissions'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_submission_notification ON public.teacher_assessment_submissions;
CREATE TRIGGER trg_submission_notification
  AFTER INSERT ON public.teacher_assessment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_assessment_submitted();

-- 10. Recalculate Student Grades & Grading Notifications Trigger Function
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

  -- Notification Trigger: Only send if a grade was updated to "Graded" or "Returned"
  IF TG_OP = 'UPDATE' AND NEW.status = 'Graded' AND OLD.status != 'Graded' THEN
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, created_at)
    VALUES (
      NEW.student_id,
      'Grade Posted: ' || COALESCE(NEW.assessment_title, 'Assessment'),
      'You received a ' || NEW.grade_value || '/' || NEW.max_points || '.',
      'You received a ' || NEW.grade_value || '/' || NEW.max_points || '.',
      'grades',
      NEW.assessment_id,
      'teacher_assessment_grades',
      now()
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'Returned' AND OLD.status != 'Returned' THEN
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type, created_at)
    VALUES (
      NEW.student_id,
      'Assignment Returned: ' || COALESCE(NEW.assessment_title, 'Assessment'),
      'Your teacher has returned ' || COALESCE(NEW.assessment_title, 'your assignment') || '.',
      'Your teacher has returned ' || COALESCE(NEW.assessment_title, 'your assignment') || '.',
      'assignments',
      NEW.assessment_id,
      'teacher_assessment_grades',
      now()
    );
  END IF;

  RETURN NULL;
END;
$$;

-- 11. Gradebook Updates Trigger Function
CREATE OR REPLACE FUNCTION public.handle_gradebook_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_subject_name text;
BEGIN
  SELECT name INTO v_subject_name FROM public.subjects WHERE id = NEW.subject_id;
  
  -- Notify Admins
  PERFORM public.notify_admins(
    CASE WHEN TG_OP = 'INSERT' THEN 'Gradebook Generated' ELSE 'Gradebook Updated' END,
    'Gradebook record ' || CASE WHEN TG_OP = 'INSERT' THEN 'generated' ELSE 'updated' END || ' for student in ' || COALESCE(v_subject_name, 'subject') || '.',
    NEW.subject_id::text,
    'subjects'
  );
  
  -- Notify Teacher
  INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
  VALUES (
    NEW.teacher_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'Gradebook Generated' ELSE 'Gradebook Updated' END,
    'Gradebook record ' || CASE WHEN TG_OP = 'INSERT' THEN 'generated' ELSE 'updated' END || ' for student in ' || COALESCE(v_subject_name, 'subject') || '.',
    'Gradebook record ' || CASE WHEN TG_OP = 'INSERT' THEN 'generated' ELSE 'updated' END || ' for student in ' || COALESCE(v_subject_name, 'subject') || '.',
    'grades',
    NEW.subject_id::text,
    'subjects'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_gradebook_updated ON public.teacher_student_grades;
CREATE TRIGGER trg_gradebook_updated
  AFTER INSERT OR UPDATE ON public.teacher_student_grades
  FOR EACH ROW EXECUTE FUNCTION public.handle_gradebook_updated();

-- 12. Messages Notification Trigger Function
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.room_id IS NOT NULL THEN
        -- Room Notification: Insert for all members except sender
        INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
        SELECT user_id, 
               'New Group Message', 
               COALESCE(NEW.content, NEW.message_text, 'Sent an attachment'), 
               COALESCE(NEW.content, NEW.message_text, 'Sent an attachment'), 
               'messages', 
               NEW.room_id::text, 
               'messages'
        FROM public.room_members
        WHERE room_id = NEW.room_id AND user_id != NEW.sender_id;
    ELSE
        -- Direct Notification
        INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
        VALUES (
            NEW.receiver_id,
            'New Message',
            COALESCE(NEW.content, NEW.message_text, 'Sent an attachment'),
            COALESCE(NEW.content, NEW.message_text, 'Sent an attachment'),
            'messages',
            NEW.id::text,
            'messages'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_received ON public.messages;
CREATE TRIGGER on_message_received
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_message_notification();

-- 13. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
