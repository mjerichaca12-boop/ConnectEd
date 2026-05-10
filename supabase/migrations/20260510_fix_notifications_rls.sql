-- Fix notifications RLS policies to properly handle user authentication

-- Drop existing policies
DROP POLICY IF EXISTS notifications_select_authenticated ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_authenticated ON public.notifications;
DROP POLICY IF EXISTS notifications_update_authenticated ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_authenticated ON public.notifications;

-- Create proper RLS policies for notifications
-- Policy: Users can only select their own notifications
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can only insert notifications for themselves
CREATE POLICY notifications_insert_own
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can only update their own notifications
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can only delete their own notifications
CREATE POLICY notifications_delete_own
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
