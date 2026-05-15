ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'Pending';