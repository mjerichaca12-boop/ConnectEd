-- Create notifications table for teacher dashboard
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text,
  related_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON public.notifications (user_id, is_read);

-- Optional foreign key if profiles table uses uuid primary key
-- ALTER TABLE public.notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
