-- Fix infinite recursion in conversation_participants and groupchats select policies
-- by leveraging the existing security-definer helper function public.is_conversation_participant.

-- 1. Redefine SELECT policy on conversation_participants to use is_conversation_participant
DROP POLICY IF EXISTS "conversation_participants_select_participants" ON public.conversation_participants;

CREATE POLICY "conversation_participants_select_participants" 
ON public.conversation_participants 
FOR SELECT 
TO authenticated 
USING (
  profile_id = auth.uid()
  OR 
  public.is_conversation_participant(conversation_id)
);

-- 2. Redefine SELECT policy on groupchats to use is_conversation_participant
DROP POLICY IF EXISTS "conversations_select_participants" ON public.groupchats;

CREATE POLICY "conversations_select_participants" 
ON public.groupchats 
FOR SELECT 
TO authenticated 
USING (
  created_by = auth.uid()
  OR
  public.is_conversation_participant(id)
);
