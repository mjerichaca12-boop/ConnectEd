-- Check if admin profile exists
SELECT id, email, role, first_name, last_name 
FROM public.profiles 
WHERE email = 'admin.connected.local' OR id = '11111111-1111-1111-1111-111111111111';

-- Check all conversation_participants for admin
SELECT cp.conversation_id, cp.profile_id, p.email, p.role, c.name, c.is_group
FROM public.conversation_participants cp
LEFT JOIN public.profiles p ON cp.profile_id = p.id
LEFT JOIN public.conversations c ON cp.conversation_id = c.id
WHERE cp.profile_id = '11111111-1111-1111-1111-111111111111'
ORDER BY cp.joined_at DESC;

-- Check all group conversations
SELECT c.id, c.name, c.is_group, c.created_by, COUNT(cp.profile_id) as participant_count
FROM public.conversations c
LEFT JOIN public.conversation_participants cp ON c.conversation_id = c.id
WHERE c.is_group = true
GROUP BY c.id, c.name, c.is_group, c.created_by
ORDER BY c.created_at DESC;

-- Check if admin is in any conversation_participants
SELECT * FROM public.conversation_participants WHERE profile_id = '11111111-1111-1111-1111-111111111111';
