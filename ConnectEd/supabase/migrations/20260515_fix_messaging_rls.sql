-- Fix RLS so the app's localStorage-based auth (no Supabase JWT) can still
-- read/write profiles, conversations, and conversation_participants via the anon key.

-- ── profiles ──────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon, authenticated;

DROP POLICY IF EXISTS profiles_select_all ON public.profiles;
CREATE POLICY profiles_select_all ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS profiles_insert_all ON public.profiles;
CREATE POLICY profiles_insert_all ON public.profiles
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS profiles_update_all ON public.profiles;
CREATE POLICY profiles_update_all ON public.profiles
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ── conversations ──────────────────────────────────────────────────────────────
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.conversations TO anon, authenticated;

DROP POLICY IF EXISTS conversations_select_all ON public.conversations;
CREATE POLICY conversations_select_all ON public.conversations
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS conversations_insert_all ON public.conversations;
CREATE POLICY conversations_insert_all ON public.conversations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ── conversation_participants ──────────────────────────────────────────────────
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.conversation_participants TO anon, authenticated;

DROP POLICY IF EXISTS conv_participants_select_all ON public.conversation_participants;
CREATE POLICY conv_participants_select_all ON public.conversation_participants
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS conv_participants_insert_all ON public.conversation_participants;
CREATE POLICY conv_participants_insert_all ON public.conversation_participants
  FOR INSERT TO anon, authenticated WITH CHECK (true);
