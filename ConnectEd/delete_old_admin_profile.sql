-- Delete the old admin profile with ID a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0
-- Keep only the correct admin profile with ID 11111111-1111-1111-1111-111111111111

-- First, remove from conversation_participants if any references exist
DELETE FROM public.conversation_participants 
WHERE profile_id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';

-- Then delete the profile
DELETE FROM public.profiles 
WHERE id = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0';

-- Verify only the correct admin remains
SELECT id, email, role FROM public.profiles WHERE email = 'admin.connected.local';
