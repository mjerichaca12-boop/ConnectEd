-- ============================================================
-- ConnectEd: Table Name Alignment & Notification Triggers
-- ============================================================

-- 1. RENAME SCHOOL_EVENTS TO SCHOOL_CALENDAR_EVENTS (if it exists under old name)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_events') 
       AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_calendar_events') THEN
        ALTER TABLE public.school_events RENAME TO school_calendar_events;
    END IF;
END $$;

-- 2. ENSURE TABLES EXIST
CREATE TABLE IF NOT EXISTS public.school_calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT DEFAULT 'Event',
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.school_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'general',
    image_url TEXT,
    file_url TEXT,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. NOTIFICATION TRIGGERS

-- Function to create notification for all users (global)
CREATE OR REPLACE FUNCTION public.notify_all_users()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, body, type)
    SELECT id, 
           CASE 
             WHEN TG_TABLE_NAME = 'school_announcements' THEN 'New Announcement: ' || NEW.title
             WHEN TG_TABLE_NAME = 'school_calendar_events' THEN 'New Event: ' || NEW.title
             ELSE 'Update: ' || NEW.title
           END,
           CASE 
             WHEN TG_TABLE_NAME = 'school_announcements' THEN LEFT(NEW.content, 100)
             WHEN TG_TABLE_NAME = 'school_calendar_events' THEN 'Date: ' || NEW.date
             ELSE 'A new item has been added'
           END,
           CASE 
             WHEN TG_TABLE_NAME = 'school_announcements' THEN 'announcement'
             WHEN TG_TABLE_NAME = 'school_calendar_events' THEN 'event'
             ELSE 'alert'
           END
    FROM public.profiles;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for announcements
DROP TRIGGER IF EXISTS on_announcement_created ON public.school_announcements;
CREATE TRIGGER on_announcement_created
    AFTER INSERT ON public.school_announcements
    FOR EACH ROW EXECUTE FUNCTION public.notify_all_users();

-- Trigger for calendar events
DROP TRIGGER IF EXISTS on_calendar_event_created ON public.school_calendar_events;
CREATE TRIGGER on_calendar_event_created
    AFTER INSERT ON public.school_calendar_events
    FOR EACH ROW EXECUTE FUNCTION public.notify_all_users();

-- 5. REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';
