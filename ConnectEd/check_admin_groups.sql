-- Check if admin can see group conversations
-- Admin ID: 11111111-1111-1111-1111-111111111111

-- 1. Check conversation participants for admin
SELECT 
    cp.conversation_id,
    cp.profile_id,
    cp.is_admin,
    cp.joined_at,
    c.name as conversation_name,
    c.is_group
FROM conversation_participants cp
JOIN conversations c ON cp.conversation_id = c.id
WHERE cp.profile_id = '11111111-1111-1111-1111-111111111111'
AND c.is_group = true
ORDER BY cp.joined_at DESC;

-- 2. Check messages in these group conversations
SELECT 
    m.id,
    m.conversation_id,
    m.sender_id,
    m.message_text,
    m.content,
    m.timestamp,
    m.created_at,
    c.name as conversation_name
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE m.conversation_id IN (
    SELECT DISTINCT cp.conversation_id 
    FROM conversation_participants cp 
    WHERE cp.profile_id = '11111111-1111-1111-1111-111111111111'
    AND cp.conversation_id IN (
        SELECT id FROM conversations WHERE is_group = true
    )
)
ORDER BY m.created_at DESC;

-- 3. Check all group conversations that exist
SELECT 
    id,
    name,
    is_group,
    created_by,
    created_at
FROM conversations
WHERE is_group = true
ORDER BY created_at DESC;
