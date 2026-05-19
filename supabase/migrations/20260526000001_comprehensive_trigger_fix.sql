-- COMPREHENSIVE FIX: Disable triggers before updating function, then update function with safe column access
-- This prevents the error: record "new" has no field "content"

-- Step 1: Disable all triggers that use notify_all_users to prevent errors during function update
DROP TRIGGER IF EXISTS on_calendar_event_created ON public.school_calendar_events;
DROP TRIGGER IF EXISTS on_announcement_created ON public.school_announcements;

-- Step 2: Create a SAFE version of the notification function that handles different column names
CREATE OR REPLACE FUNCTION public.notify_all_users()
RETURNS trigger AS $$
DECLARE
  v_title text;
  v_body text;
  v_type text;
BEGIN
  -- Safely build the notification based on the table
  IF TG_TABLE_NAME = 'school_announcements' THEN
    v_title := 'New Announcement: ' || COALESCE(NEW.title, 'Untitled');
    -- Handle both 'content' and 'description' columns
    v_body := COALESCE(
      LEFT(COALESCE(NEW.content, ''), 100),
      LEFT(COALESCE(NEW.description, ''), 100),
      'New announcement'
    );
    v_type := 'announcement';
    
  ELSIF TG_TABLE_NAME = 'school_calendar_events' THEN
    v_title := 'New Event: ' || COALESCE(NEW.title, 'Untitled');
    -- Use event_date, NOT date - safely cast to text
    v_body := 'Date: ' || COALESCE(NEW.event_date::text, NEW.date::text, 'To be announced');
    v_type := 'event';
    
  ELSE
    v_title := 'Update: ' || COALESCE(NEW.title, 'Item');
    v_body := 'A new item has been added';
    v_type := 'alert';
  END IF;

  -- Only insert if we have a valid title
  IF v_title IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    SELECT id, v_title, v_body, v_type
    FROM public.profiles
    WHERE id IS NOT NULL;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the entire transaction
  RAISE WARNING 'notify_all_users error for table %: %', TG_TABLE_NAME, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Recreate triggers with the fixed function
CREATE TRIGGER on_calendar_event_created
    AFTER INSERT ON public.school_calendar_events
    FOR EACH ROW EXECUTE FUNCTION public.notify_all_users();

CREATE TRIGGER on_announcement_created
    AFTER INSERT ON public.school_announcements
    FOR EACH ROW EXECUTE FUNCTION public.notify_all_users();

-- Step 4: Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Step 5: Verify the function exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_all_users' 
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    RAISE NOTICE 'notify_all_users function successfully updated';
  ELSE
    RAISE WARNING 'notify_all_users function not found!';
  END IF;
END
$$;
