-- Create the missing group conversations and add admin as participant
-- Based on the conversation IDs you provided

-- First, create the group conversations if they don't exist
INSERT INTO public.conversations (id, name, is_group, created_by, created_at)
VALUES 
    ('group_f527392f-f9b7-44cf-b4a0-617f7aa18d29', 'Group Chat 1', true, '11111111-1111-1111-1111-111111111111', NOW()),
    ('group_913497d7-91f0-44f5-b110-9627724fc398', 'Group Chat 2', true, '11111111-1111-1111-1111-111111111111', NOW()),
    ('group_76627122-8098-4fd1-92f1-cb01e8cd7992', 'Group Chat 3', true, '11111111-1111-1111-1111-111111111111', NOW()),
    ('group_da10cd2a-1a4c-4c4e-8e9c-ec233b9af982', 'Group Chat 4', true, '11111111-1111-1111-1111-111111111111', NOW()),
    ('group_935f5b29-b1f5-4710-be23-136dbd3d693f', 'Group Chat 5', true, '11111111-1111-1111-1111-111111111111', NOW()),
    ('group_b32a6f60-88db-4f98-9b94-6c5fdb8f4201', 'Group Chat 6', true, '11111111-1111-1111-1111-111111111111', NOW()),
    ('group_b7c57ca5-bf0d-4857-a911-04cee6dc4d97', 'Group Chat 7', true, '11111111-1111-1111-1111-111111111111', NOW())
ON CONFLICT (id) DO NOTHING;

-- Add admin as participant to all these group conversations
INSERT INTO public.conversation_participants (conversation_id, profile_id, is_admin, joined_at)
VALUES 
    ('group_f527392f-f9b7-44cf-b4a0-617f7aa18d29', '11111111-1111-1111-1111-111111111111', false, NOW()),
    ('group_913497d7-91f0-44f5-b110-9627724fc398', '11111111-1111-1111-1111-111111111111', false, NOW()),
    ('group_76627122-8098-4fd1-92f1-cb01e8cd7992', '11111111-1111-1111-1111-111111111111', false, NOW()),
    ('group_da10cd2a-1a4c-4c4e-8e9c-ec233b9af982', '11111111-1111-1111-1111-111111111111', false, NOW()),
    ('group_935f5b29-b1f5-4710-be23-136dbd3d693f', '11111111-1111-1111-1111-111111111111', false, NOW()),
    ('group_b32a6f60-88db-4f98-9b94-6c5fdb8f4201', '11111111-1111-1111-1111-111111111111', false, NOW()),
    ('group_b7c57ca5-bf0d-4857-a911-04cee6dc4d97', '11111111-1111-1111-1111-111111111111', false, NOW())
ON CONFLICT (conversation_id, profile_id) DO NOTHING;

-- Add some sample messages to each group conversation
INSERT INTO public.messages (sender_id, conversation_id, message_text, content, timestamp, created_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'group_f527392f-f9b7-44cf-b4a0-617f7aa18d29', 'Welcome to Group Chat 1', 'Welcome to Group Chat 1', NOW(), NOW()),
    ('11111111-1111-1111-1111-111111111111', 'group_913497d7-91f0-44f5-b110-9627724fc398', 'Welcome to Group Chat 2', 'Welcome to Group Chat 2', NOW(), NOW()),
    ('11111111-1111-1111-1111-111111111111', 'group_76627122-8098-4fd1-92f1-cb01e8cd7992', 'Welcome to Group Chat 3', 'Welcome to Group Chat 3', NOW(), NOW()),
    ('11111111-1111-1111-1111-111111111111', 'group_da10cd2a-1a4c-4c4e-8e9c-ec233b9af982', 'Welcome to Group Chat 4', 'Welcome to Group Chat 4', NOW(), NOW()),
    ('11111111-1111-1111-1111-111111111111', 'group_935f5b29-b1f5-4710-be23-136dbd3d693f', 'Welcome to Group Chat 5', 'Welcome to Group Chat 5', NOW(), NOW()),
    ('11111111-1111-1111-1111-111111111111', 'group_b32a6f60-88db-4f98-9b94-6c5fdb8f4201', 'Welcome to Group Chat 6', 'Welcome to Group Chat 6', NOW(), NOW()),
    ('11111111-1111-1111-1111-111111111111', 'group_b7c57ca5-bf0d-4857-a911-04cee6dc4d97', 'Welcome to Group Chat 7', 'Welcome to Group Chat 7', NOW(), NOW());

-- Verify the data was inserted
SELECT 
    c.id as conversation_id,
    c.name as conversation_name,
    c.is_group,
    cp.profile_id,
    p.email as admin_email,
    cp.joined_at
FROM public.conversations c
JOIN public.conversation_participants cp ON c.id = cp.conversation_id
LEFT JOIN public.profiles p ON cp.profile_id = p.id
WHERE c.is_group = true
AND cp.profile_id = '11111111-1111-1111-1111-111111111111'
ORDER BY c.created_at;
