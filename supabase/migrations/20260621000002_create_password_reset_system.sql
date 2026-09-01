-- Migration: Create Password Reset System
-- Date: 2026-06-21

-- 1. Add columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_password_reset timestamptz NULL;

-- 2. Create password_reset_requests table
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying pending requests quickly
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON public.password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_created_at ON public.password_reset_requests(created_at DESC);

-- Enable RLS on password_reset_requests
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated to insert requests (for forgot password page)
DROP POLICY IF EXISTS password_reset_requests_insert ON public.password_reset_requests;
CREATE POLICY password_reset_requests_insert
ON public.password_reset_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow authenticated admins to view/update requests
DROP POLICY IF EXISTS password_reset_requests_select_admin ON public.password_reset_requests;
CREATE POLICY password_reset_requests_select_admin
ON public.password_reset_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS password_reset_requests_update_admin ON public.password_reset_requests;
CREATE POLICY password_reset_requests_update_admin
ON public.password_reset_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);


-- 3. Create password_reset_logs table
CREATE TABLE IF NOT EXISTS public.password_reset_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  reset_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  temporary_password_generated boolean DEFAULT true,
  reset_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_user_id ON public.password_reset_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_reset_date ON public.password_reset_logs(reset_date DESC);

-- Enable RLS on password_reset_logs
ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

-- Admins can insert and view logs
DROP POLICY IF EXISTS password_reset_logs_insert_admin ON public.password_reset_logs;
CREATE POLICY password_reset_logs_insert_admin
ON public.password_reset_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS password_reset_logs_select_admin ON public.password_reset_logs;
CREATE POLICY password_reset_logs_select_admin
ON public.password_reset_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
