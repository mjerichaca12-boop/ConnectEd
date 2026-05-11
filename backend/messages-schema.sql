-- ============================================================
-- 0. FIX NOTIFICATIONS TABLE (Ensures 'body' column exists)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT;
-- ============================================================

-- 1. CHAT ROOMS (for group chats)
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. ROOM MEMBERS
CREATE TABLE IF NOT EXISTS public.room_members (
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (room_id, user_id)
);

-- 3. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Nullable for group chats
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,     -- Null for one-to-one
    content TEXT,
    message_text TEXT,
    file_url TEXT,
    file_type TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT one_target_only CHECK (
        (receiver_id IS NOT NULL AND room_id IS NULL) OR 
        (receiver_id IS NULL AND room_id IS NOT NULL)
    )
);

-- Ensure columns exist if table was already created
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Make content NOT NULL if it's empty (optional, but safer to just allow NULL if needed)
-- ALTER TABLE public.messages ALTER COLUMN content SET NOT NULL; 
-- Wait, if it's a new setup, it's fine. If old data exists, NOT NULL might fail.


-- RLS for Rooms
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view rooms they are members of." ON public.chat_rooms
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = id AND user_id = auth.uid())
);

-- RLS for Room Members
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view other members." ON public.room_members
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.room_members m2 WHERE m2.room_id = room_id AND m2.user_id = auth.uid())
);

-- 2. POLICIES
DROP POLICY IF EXISTS "Users can view their own message history." ON public.messages;
CREATE POLICY "Users can view their own message history." 
ON public.messages FOR SELECT 
USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = messages.room_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can send messages." ON public.messages;
CREATE POLICY "Users can send messages." 
ON public.messages FOR INSERT 
WITH CHECK (
    auth.uid() = sender_id AND (
        receiver_id IS NOT NULL OR 
        EXISTS (SELECT 1 FROM public.room_members WHERE room_id = messages.room_id AND user_id = auth.uid())
    )
);

DROP POLICY IF EXISTS "Users can update is_read status." ON public.messages;
CREATE POLICY "Users can update is_read status." 
ON public.messages FOR UPDATE 
USING (
    auth.uid() = receiver_id OR
    EXISTS (SELECT 1 FROM public.room_members WHERE room_id = messages.room_id AND user_id = auth.uid())
);

-- 3. NOTIFICATION TRIGGER
-- Automatically insert a notification when a new message is received
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.room_id IS NOT NULL THEN
        -- Room Notification: Insert for all members except sender
        INSERT INTO public.notifications (user_id, title, body, type)
        SELECT user_id, 'New Group Message', COALESCE(NEW.content, NEW.message_text, 'Sent an attachment'), 'chat'
        FROM public.room_members
        WHERE room_id = NEW.room_id AND user_id != NEW.sender_id;
    ELSE
        -- Direct Notification
        INSERT INTO public.notifications (user_id, title, body, type)
        VALUES (
            NEW.receiver_id,
            'New Message',
            COALESCE(NEW.content, NEW.message_text, 'Sent an attachment'),
            'chat'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_received ON public.messages;
CREATE TRIGGER on_message_received
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_message_notification();

-- 4. CHAT LIST VIEW
DROP VIEW IF EXISTS public.chat_list;
-- Returns a list of the latest message for every distinct conversation (Direct or Room)
CREATE OR REPLACE VIEW public.chat_list AS
WITH UserChats AS (
    -- Direct Messages
    SELECT 
        DISTINCT ON (partner_id)
        id,
        sender_id,
        receiver_id,
        room_id,
        content,
        created_at,
        is_read,
        CASE 
            WHEN sender_id = auth.uid() THEN receiver_id 
            ELSE sender_id 
        END as partner_id,
        NULL::UUID as room_id_alias,
        'direct' as chat_type
    FROM public.messages
    WHERE room_id IS NULL AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    ORDER BY partner_id, created_at DESC
    
    UNION ALL
    
    -- Room Messages
    SELECT 
        DISTINCT ON (room_id)
        m.id,
        m.sender_id,
        m.receiver_id,
        m.room_id,
        m.content,
        m.created_at,
        m.is_read,
        m.room_id as partner_id,
        m.room_id as room_id_alias,
        'group' as chat_type
    FROM public.messages m
    JOIN public.room_members rm ON m.room_id = rm.room_id
    WHERE rm.user_id = auth.uid()
    ORDER BY m.room_id, m.created_at DESC
)
SELECT 
    uc.*,
    COALESCE(p.first_name || ' ' || p.last_name, cr.name) as partner_name,
    COALESCE(p.role, 'group') as partner_role,
    (SELECT COUNT(*) FROM public.messages m2 
     WHERE (m2.receiver_id = auth.uid() AND m2.sender_id = uc.partner_id AND m2.is_read = false)
        OR (m2.room_id = uc.room_id_alias AND m2.sender_id != auth.uid() AND m2.is_read = false)
    ) as unread_count
FROM UserChats uc
LEFT JOIN public.profiles p ON uc.partner_id = p.id AND uc.chat_type = 'direct'
LEFT JOIN public.chat_rooms cr ON uc.room_id_alias = cr.id AND uc.chat_type = 'group';

GRANT SELECT ON public.chat_list TO authenticated;

-- 5. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

-- 6. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
