-- Migration: Fix Notifications Isolation & RLS Security
-- Date: 2026-09-06

-- 1. Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing permissive policies
DROP POLICY IF EXISTS "Notifications are viewable by everyone." ON public.notifications;
DROP POLICY IF EXISTS "anon_delete_notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications." ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications." ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications." ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications." ON public.notifications;

-- 3. Create strict user-scoped policies
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

-- 4. Update Trigger Function for School Announcements to ensure strict audience matching
CREATE OR REPLACE FUNCTION public.handle_school_announcement_created()
RETURNS TRIGGER AS $$
DECLARE
  v_audience text;
BEGIN
  v_audience := LOWER(TRIM(COALESCE(NEW.target_audience, 'school-wide')));
  
  IF v_audience LIKE '%school%' OR v_audience LIKE '%all%' THEN
    -- School-wide: insert for all active profiles
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
    SELECT id, 
           'New Announcement: ' || NEW.title, 
           LEFT(COALESCE(NEW.content, NEW.title), 100), 
           LEFT(COALESCE(NEW.content, NEW.title), 100), 
           'announcement', 
           NEW.id::text, 
           'school_announcements'
    FROM public.profiles
    WHERE id IS NOT NULL;
  ELSIF v_audience LIKE '%student%' THEN
    -- Students only: insert for student role only
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
    SELECT id, 
           'New Announcement: ' || NEW.title, 
           LEFT(COALESCE(NEW.content, NEW.title), 100), 
           LEFT(COALESCE(NEW.content, NEW.title), 100), 
           'announcement', 
           NEW.id::text, 
           'school_announcements'
    FROM public.profiles
    WHERE LOWER(role) = 'student' AND id IS NOT NULL;
  ELSIF v_audience LIKE '%teacher%' OR v_audience LIKE '%faculty%' THEN
    -- Teachers only: insert for teacher role only
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
    SELECT id, 
           'New Announcement: ' || NEW.title, 
           LEFT(COALESCE(NEW.content, NEW.title), 100), 
           LEFT(COALESCE(NEW.content, NEW.title), 100), 
           'announcement', 
           NEW.id::text, 
           'school_announcements'
    FROM public.profiles
    WHERE LOWER(role) = 'teacher' AND id IS NOT NULL;
  ELSIF v_audience LIKE '%admin%' OR v_audience LIKE '%staff%' THEN
    -- Admins only: insert for admin role only
    INSERT INTO public.notifications (user_id, title, body, message, type, related_id, related_type)
    SELECT id, 
           'New Announcement: ' || NEW.title, 
           LEFT(COALESCE(NEW.content, NEW.title), 100), 
           LEFT(COALESCE(NEW.content, NEW.title), 100), 
           'announcement', 
           NEW.id::text, 
           'school_announcements'
    FROM public.profiles
    WHERE LOWER(role) = 'admin' AND id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_announcement_created ON public.school_announcements;
CREATE TRIGGER on_announcement_created
  AFTER INSERT ON public.school_announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_school_announcement_created();
