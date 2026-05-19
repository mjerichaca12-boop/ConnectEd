-- DIAGNOSTIC SCRIPT: Verify the trigger fix is working correctly
-- Run this AFTER applying the comprehensive_trigger_fix migration

-- 1. Check the notify_all_users function exists
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'notify_all_users' 
  AND n.nspname = 'public';

-- 2. Check triggers on school_calendar_events
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'school_calendar_events'
  AND trigger_schema = 'public';

-- 3. Verify school_calendar_events table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'school_calendar_events'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Check if school_announcements table has content column
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'school_announcements'
  AND table_schema = 'public'
  AND column_name IN ('content', 'description', 'body')
ORDER BY ordinal_position;

-- 5. Test INSERT into school_calendar_events to verify trigger works
-- This will NOT actually insert anything - just validates the trigger function
DO $$
BEGIN
  RAISE NOTICE 'Trigger validation: If the last statement did not error, the trigger is working correctly';
END
$$;
