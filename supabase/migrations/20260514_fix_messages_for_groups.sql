-- Fix messages table schema to support group conversations
-- This makes receiver_id nullable, as group messages use conversation_id instead

ALTER TABLE IF EXISTS public.messages 
ALTER COLUMN receiver_id DROP NOT NULL;

-- Also ensure conversation_id column exists (redundant but safe)
ALTER TABLE IF EXISTS public.messages 
ADD COLUMN IF NOT EXISTS conversation_id text;

-- Ensure content column exists for metadata
ALTER TABLE IF EXISTS public.messages 
ADD COLUMN IF NOT EXISTS content text;
