-- Fix Row Level Security (RLS) policies for groupchats and conversation_participants
-- to resolve the circular dependency (chicken-and-egg) issue during group creation.

-- 1. Update SELECT policy on groupchats to allow the creator to view the group
-- even before they are added to conversation_participants.
DROP POLICY IF EXISTS "conversations_select_participants" ON public.groupchats;

CREATE POLICY "conversations_select_participants" 
ON public.groupchats 
FOR SELECT 
TO authenticated 
USING (
  created_by = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_participants.conversation_id = groupchats.id 
    AND conversation_participants.profile_id = auth.uid()
  )
);

-- 2. Update INSERT policy on conversation_participants to allow the creator of the group chat
-- to add themselves and other members.
DROP POLICY IF EXISTS "conversation_participants_insert_authenticated" ON public.conversation_participants;

CREATE POLICY "conversation_participants_insert_authenticated" 
ON public.conversation_participants 
FOR INSERT 
TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.groupchats 
    WHERE groupchats.id = conversation_id 
    AND groupchats.created_by = auth.uid()
  )
);

-- 3. Update SELECT policy on conversation_participants to allow members of a group chat
-- to see who else is in the same group chat (enabling member lists to load).
DROP POLICY IF EXISTS "conversation_participants_select_participants" ON public.conversation_participants;

CREATE POLICY "conversation_participants_select_participants" 
ON public.conversation_participants 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_participants.conversation_id 
    AND cp.profile_id = auth.uid()
  )
);
