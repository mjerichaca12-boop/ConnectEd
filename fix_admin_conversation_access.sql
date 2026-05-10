-- Add RLS policy to allow admin to see conversation participants
-- This policy allows authenticated users to see all conversation participants
-- not just their own entries

DROP POLICY IF EXISTS "conversation_participants_select_participants";

CREATE POLICY "conversation_participants_select_participants"
ON "conversation_participants"
FOR SELECT
USING (supabase.auth.uid() = profile_id OR auth.role() = 'admin'::text)
WITH CHECK (true);
