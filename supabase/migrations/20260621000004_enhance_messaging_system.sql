-- 1. Add status to messages
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read'));

-- 2. Create message_attachments table
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS message_attachments_message_id_idx ON public.message_attachments(message_id);

-- Enable RLS
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for message_attachments
-- Allow sender and receiver to see attachments
CREATE POLICY "Allow sender and receiver to select attachments" ON public.message_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_attachments.message_id
    AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  )
);

-- Allow sender to insert attachments
CREATE POLICY "Allow sender to insert attachments" ON public.message_attachments
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_attachments.message_id
    AND m.sender_id = auth.uid()
  )
);

-- Allow sender to delete their own attachments
CREATE POLICY "Allow sender to delete attachments" ON public.message_attachments
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_attachments.message_id
    AND m.sender_id = auth.uid()
  )
);

-- 4. Update Storage Policies for 10MB Limit
-- First ensure bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('message-attachments', 'message-attachments', true, 10485760)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

-- Drop existing insert policy to recreate it with strict size limit
DROP POLICY IF EXISTS message_attachments_storage_insert_public ON storage.objects;

-- Create strict insert policy for message attachments
CREATE POLICY message_attachments_storage_insert_strict ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND (storage.foldername(name))[1] != 'private'
);

-- Note: The strict 10MB limit is enforced natively by Supabase Storage `file_size_limit` property of the bucket, which we just updated via the INSERT ON CONFLICT above.
