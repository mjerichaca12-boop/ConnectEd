-- Allow anon/authenticated roles to read their own notifications (for realtime)
-- App uses custom auth (not Supabase Auth), so user_id matching is done client-side.
-- Service role (supabaseAdmin) bypasses RLS entirely for reads/updates.
-- These policies allow realtime subscriptions via the anon key to receive INSERT events.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop any conflicting old policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_select_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_update_notifications" ON public.notifications;
DROP POLICY IF EXISTS "service_role_all_notifications" ON public.notifications;

-- Service role has full access (used by supabaseAdmin client and triggers)
CREATE POLICY "service_role_all_notifications"
  ON public.notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon/authenticated: allow SELECT so realtime can receive events
-- (actual per-user filtering is enforced client-side)
CREATE POLICY "anon_select_notifications"
  ON public.notifications
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anon/authenticated: allow UPDATE so marking as read works
CREATE POLICY "anon_update_notifications"
  ON public.notifications
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
