-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to select notifications (app handles filtering via user_id)
CREATE POLICY notifications_select_authenticated
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow authenticated users to insert notifications
CREATE POLICY notifications_insert_authenticated
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Allow authenticated users to update notifications
CREATE POLICY notifications_update_authenticated
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow authenticated users to delete notifications
CREATE POLICY notifications_delete_authenticated
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (true);
