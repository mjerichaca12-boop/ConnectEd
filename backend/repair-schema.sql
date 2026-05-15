-- ============================================================
-- ConnectEd: SCHEMA REPAIR (Run this in Supabase SQL Editor)
-- ============================================================

-- 1. FIX MESSAGES TABLE (Ensure room_id exists and receiver_id is optional)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS room_id UUID;
ALTER TABLE public.messages ALTER COLUMN receiver_id DROP NOT NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 2. CREATE CHAT ROOMS & MEMBERS (If missing)
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.room_members (
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (room_id, user_id)
);

-- SECURITY DEFINER function to break RLS recursion
CREATE OR REPLACE FUNCTION public.is_room_member(room_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE room_id::text = room_id_param AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECREATE CHAT LIST VIEW (Handles Direct and Group)
DROP VIEW IF EXISTS public.chat_list;
CREATE OR REPLACE VIEW public.chat_list AS
WITH AllRelevantMessages AS (
    SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        m.room_id,
        m.content,
        m.created_at,
        m.is_read,
        CASE 
            WHEN m.room_id IS NOT NULL THEN m.room_id
            WHEN m.sender_id = auth.uid() THEN m.receiver_id 
            ELSE m.sender_id 
        END as partner_id,
        m.room_id as room_id_alias,
        CASE 
            WHEN m.room_id IS NOT NULL THEN 'group' 
            ELSE 'direct' 
        END as chat_type
    FROM public.messages m
    WHERE 
        (m.room_id IS NULL AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid()))
        OR 
        (m.room_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.room_members rm 
            WHERE rm.room_id = m.room_id AND rm.user_id = auth.uid()
        ))
),
UserChats AS (
    SELECT DISTINCT ON (partner_id) *
    FROM AllRelevantMessages
    ORDER BY partner_id, created_at DESC
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

-- 4. RLS POLICIES FOR MESSAGING
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own messages." ON public.messages;
CREATE POLICY "Users can view their own messages." ON public.messages FOR SELECT 
USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    (room_id IS NOT NULL AND public.is_room_member(room_id::text))
);

DROP POLICY IF EXISTS "Users can send messages." ON public.messages;
CREATE POLICY "Users can send messages." ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- 5. REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';

-- 6. SCHOOL EVENTS NOTIFICATIONS
-- Function to notify all users about a new school event
CREATE OR REPLACE FUNCTION public.handle_new_school_event()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, body, type)
    SELECT id, 'New Event: ' || NEW.title, 'A new school event has been scheduled for ' || NEW.date, 'event'
    FROM public.profiles;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new school event
DROP TRIGGER IF EXISTS on_school_event_created ON public.school_events;
CREATE TRIGGER on_school_event_created
    AFTER INSERT ON public.school_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_school_event();
