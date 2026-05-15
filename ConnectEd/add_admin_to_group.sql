-- Add system administrator to the group conversation
-- This will allow the admin to see group messages

-- Insert admin into conversation_participants for the specific group
INSERT INTO public.conversation_participants (conversation_id, profile_id, joined_at)
VALUES (
  'group_76627122-8098-4fd1-92f1-cb01e8cd7992',
  '11111111-1111-1111-1111-111111111111',
  NOW()
)
ON CONFLICT (conversation_id, profile_id) DO NOTHING;

-- Verify the insertion
SELECT * FROM public.conversation_participants 
WHERE conversation_id = 'group_76627122-8098-4fd1-92f1-cb01e8cd7992';
