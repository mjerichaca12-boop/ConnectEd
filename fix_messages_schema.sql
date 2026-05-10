-- Fix messages table schema to add conversation_id column
-- This migration adds the missing conversation_id column to support group messages

-- Add conversation_id column if it doesn't exist
ALTER TABLE IF EXISTS public.messages 
ADD COLUMN IF NOT EXISTS conversation_id text;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_conversation_fk' 
    AND table_name = 'messages' 
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.messages 
    ADD CONSTRAINT messages_conversation_fk 
    FOREIGN KEY (conversation_id) 
    REFERENCES public.conversations(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS messages_conversation_idx 
ON public.messages (conversation_id);
