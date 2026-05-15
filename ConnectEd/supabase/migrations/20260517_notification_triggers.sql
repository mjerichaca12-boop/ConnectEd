-- Migration: Notification Triggers
-- This script adds triggers to automatically create notifications for key events.

-- 1. Helper function to create notifications
CREATE OR REPLACE FUNCTION public.create_notification_record(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_id text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (p_user_id, p_type, p_title, p_message, p_related_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Announcement Trigger
CREATE OR REPLACE FUNCTION public.handle_announcement_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notifications for target audience
  IF NEW.target_audience = 'School-wide' THEN
    -- Notify everyone (Teachers and Students)
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    SELECT id, 'announcement', NEW.title, left(NEW.content, 100), NEW.id::text
    FROM public.profiles
    WHERE role IN ('teacher', 'student');
  ELSIF NEW.target_audience = 'Students' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    SELECT id, 'announcement', NEW.title, left(NEW.content, 100), NEW.id::text
    FROM public.profiles WHERE role = 'student';
  ELSIF NEW.target_audience = 'Teacher' THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    SELECT id, 'announcement', NEW.title, left(NEW.content, 100), NEW.id::text
    FROM public.profiles WHERE role = 'teacher';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_announcement_notification ON public.announcements;
CREATE TRIGGER trg_announcement_notification
AFTER INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.handle_announcement_notification();

DROP TRIGGER IF EXISTS trg_school_announcement_notification ON public.school_announcements;
CREATE TRIGGER trg_school_announcement_notification
AFTER INSERT ON public.school_announcements
FOR EACH ROW EXECUTE FUNCTION public.handle_announcement_notification();

-- 3. Grade Trigger
CREATE OR REPLACE FUNCTION public.handle_grade_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify student when a grade is inserted or updated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.grade_value <> NEW.grade_value) THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (
      NEW.student_id,
      'grades',
      'Grade Updated',
      'Your grade for ' || NEW.assessment_title || ' has been updated to ' || NEW.grade_value,
      NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_grade_notification ON public.teacher_assessment_grades;
CREATE TRIGGER trg_grade_notification
AFTER INSERT OR UPDATE ON public.teacher_assessment_grades
FOR EACH ROW EXECUTE FUNCTION public.handle_grade_notification();

-- 4. Message Trigger
CREATE OR REPLACE FUNCTION public.handle_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_participant_id uuid;
BEGIN
  -- Direct message notification
  IF NEW.receiver_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id)
    VALUES (
      NEW.receiver_id,
      'messages',
      'New Message',
      left(NEW.message_text, 100),
      NEW.id::text
    );
  END IF;

  -- Group message notification
  IF NEW.conversation_id IS NOT NULL THEN
    FOR v_participant_id IN 
      SELECT profile_id FROM public.conversation_participants 
      WHERE conversation_id = NEW.conversation_id AND profile_id <> NEW.sender_id
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, related_id)
      VALUES (v_participant_id, 'messages', 'Group Message', left(NEW.message_text, 100), NEW.id::text);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_message_notification ON public.messages;
CREATE TRIGGER trg_message_notification
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.handle_message_notification();

-- 5. Submission Trigger (for Teachers)
CREATE OR REPLACE FUNCTION public.handle_submission_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id)
  VALUES (
    NEW.teacher_id,
    'assignments',
    'New Submission',
    'A student has submitted an assessment for your subject.',
    NEW.id::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_submission_notification ON public.teacher_assessment_submissions;
CREATE TRIGGER trg_submission_notification
AFTER INSERT ON public.teacher_assessment_submissions
FOR EACH ROW EXECUTE FUNCTION public.handle_submission_notification();

-- 6. Enable Realtime for Notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
