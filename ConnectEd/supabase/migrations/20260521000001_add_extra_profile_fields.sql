-- Add extra profile fields for students
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS guardian_name TEXT,
ADD COLUMN IF NOT EXISTS guardian_contact TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Update RLS policies to allow users to update their own extra fields
-- (The existing policy profiles_update_all already allows updates to any column)
