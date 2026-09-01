-- Add missing columns to school_events table (if it exists)
-- This ensures backward compatibility with any existing data

DO $$
BEGIN
  -- Add target_audience column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'school_events' 
    AND column_name = 'target_audience'
  ) THEN
    ALTER TABLE public.school_events ADD COLUMN target_audience text not null default 'School-wide';
    ALTER TABLE public.school_events ADD CONSTRAINT school_events_target_audience_check
      CHECK (target_audience IN ('School-wide', 'Teachers', 'Students'));
  END IF;

  -- Add event_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'school_events' 
    AND column_name = 'event_date'
  ) THEN
    ALTER TABLE public.school_events ADD COLUMN event_date date not null default CURRENT_DATE;
  END IF;

  -- Add event_time column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'school_events' 
    AND column_name = 'event_time'
  ) THEN
    ALTER TABLE public.school_events ADD COLUMN event_time time;
  END IF;

  -- Add description column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'school_events' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.school_events ADD COLUMN description text;
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'school_events' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.school_events ADD COLUMN created_at timestamptz not null default now();
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'school_events' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.school_events ADD COLUMN updated_at timestamptz not null default now();
  END IF;

END
$$;

-- Create updated_at trigger for school_events if it doesn't exist
DROP TRIGGER IF EXISTS trg_set_school_events_updated_at ON public.school_events;

CREATE TRIGGER trg_set_school_events_updated_at
BEFORE UPDATE ON public.school_events
FOR EACH ROW
EXECUTE FUNCTION public.set_school_calendar_events_updated_at();

-- Ensure proper RLS policies on school_events
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_events TO anon, authenticated;
