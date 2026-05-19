-- Fix the notification trigger function to use correct column names
-- The previous trigger was trying to access NEW.date and NEW.content which don't exist
-- on the school_calendar_events table. It should use NEW.event_date instead.

CREATE OR REPLACE FUNCTION public.notify_all_users()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, body, type)
    SELECT id, 
           CASE 
             WHEN TG_TABLE_NAME = 'school_announcements' THEN 'New Announcement: ' || COALESCE(NEW.title, 'Untitled')
             WHEN TG_TABLE_NAME = 'school_calendar_events' THEN 'New Event: ' || COALESCE(NEW.title, 'Untitled')
             ELSE 'Update: ' || COALESCE(NEW.title, 'Item')
           END,
           CASE 
             WHEN TG_TABLE_NAME = 'school_announcements' THEN LEFT(COALESCE(NEW.content, NEW.description, 'New announcement'), 100)
             WHEN TG_TABLE_NAME = 'school_calendar_events' THEN 'Date: ' || COALESCE(NEW.event_date::text, NEW.date::text, 'To be announced')
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

-- Recreate trigger with the fixed function
DROP TRIGGER IF EXISTS on_calendar_event_created ON public.school_calendar_events;

CREATE TRIGGER on_calendar_event_created
    AFTER INSERT ON public.school_calendar_events
    FOR EACH ROW EXECUTE FUNCTION public.notify_all_users();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
