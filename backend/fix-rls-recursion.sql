-- ============================================================
-- ConnectEd: FIX RLS INFINITE RECURSION (Aggressive Cleanup)
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. FUNCTIONS (Using TEXT for maximum compatibility)
CREATE OR REPLACE FUNCTION public.is_room_member(room_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.room_members 
        WHERE room_id::text = room_id_param AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.conversation_participants 
        WHERE conversation_id::text = conv_id_param AND profile_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. CLEANUP & APPLY FIX (Drops ALL existing policies to ensure no recursion remains)

-- Fix Room Members
DO $$ 
DECLARE pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'room_members') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.room_members', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "room_members_select_policy" ON public.room_members
FOR SELECT USING (user_id = auth.uid() OR public.is_room_member(room_id::text));


-- Fix Chat Rooms
DO $$ 
DECLARE pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'chat_rooms') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.chat_rooms', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "chat_rooms_select_policy" ON public.chat_rooms
FOR SELECT USING (public.is_room_member(id::text));


-- Fix Messages
DO $$ 
DECLARE pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'messages') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "messages_select_policy" ON public.messages
FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR
    (room_id IS NOT NULL AND public.is_room_member(room_id::text))
);

CREATE POLICY "messages_insert_policy" ON public.messages
FOR INSERT WITH CHECK (auth.uid() = sender_id);


-- 3. FIX CONVERSATION_PARTICIPANTS (Aggressive cleanup for the specific error)
DO $$ 
DECLARE pol RECORD;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_participants') THEN
        -- Drop ALL existing policies
        FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversation_participants') LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversation_participants', pol.policyname);
        END LOOP;
        
        -- Enable RLS and create one clean policy
        EXECUTE 'ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'CREATE POLICY "conversation_participants_select_policy" ON public.conversation_participants FOR SELECT USING (profile_id = auth.uid() OR public.is_conversation_participant(conversation_id::text));';
    END IF;
END $$;


-- 4. REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';
