-- ============================================================
-- 1. ONLINE CLASS MEETINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.online_class_meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_code TEXT,
    subject TEXT,
    title TEXT NOT NULL,
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration TEXT DEFAULT '1h',
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    meeting_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Fix for existing tables missing columns
ALTER TABLE public.online_class_meetings ADD COLUMN IF NOT EXISTS time TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.online_class_meetings ADD COLUMN IF NOT EXISTS subject_code TEXT;
ALTER TABLE public.online_class_meetings ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '1h';
ALTER TABLE public.online_class_meetings ADD COLUMN IF NOT EXISTS meeting_link TEXT;


ALTER TABLE public.online_class_meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Meetings are viewable by everyone." ON public.online_class_meetings;
CREATE POLICY "Meetings are viewable by everyone." ON public.online_class_meetings FOR SELECT USING (true);

-- Insert some dummy meetings if table is empty
INSERT INTO public.online_class_meetings (subject, title, time, duration)
SELECT 'Mobile Dev', 'React Native Basics', NOW() + INTERVAL '1 hour', '1h 30m'
WHERE NOT EXISTS (SELECT 1 FROM public.online_class_meetings);

-- ============================================================
-- 2. MESSAGES & STORAGE FIXES
-- ============================================================

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for chat-attachments
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Owner Delete" ON storage.objects;
CREATE POLICY "Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'chat-attachments' AND auth.uid() = owner);

-- Refresh PostgREST
NOTIFY pgrst, 'reload schema';
