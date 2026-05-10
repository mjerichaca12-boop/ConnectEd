-- Verify and add file attachment columns to messages table if missing
-- This script checks if the file_url, file_name, file_type, and file_size columns exist
-- and adds them if they don't

-- Check current columns in messages table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Add file_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' 
    AND table_schema = 'public'
    AND column_name = 'file_url'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN file_url text;
    RAISE NOTICE 'Added file_url column';
  ELSE
    RAISE NOTICE 'file_url column already exists';
  END IF;
END $$;

-- Add file_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' 
    AND table_schema = 'public'
    AND column_name = 'file_name'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN file_name text;
    RAISE NOTICE 'Added file_name column';
  ELSE
    RAISE NOTICE 'file_name column already exists';
  END IF;
END $$;

-- Add file_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' 
    AND table_schema = 'public'
    AND column_name = 'file_type'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN file_type text;
    RAISE NOTICE 'Added file_type column';
  ELSE
    RAISE NOTICE 'file_type column already exists';
  END IF;
END $$;

-- Add file_size column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' 
    AND table_schema = 'public'
    AND column_name = 'file_size'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN file_size bigint;
    RAISE NOTICE 'Added file_size column';
  ELSE
    RAISE NOTICE 'file_size column already exists';
  END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
AND table_schema = 'public'
AND column_name IN ('file_url', 'file_name', 'file_type', 'file_size')
ORDER BY column_name;
