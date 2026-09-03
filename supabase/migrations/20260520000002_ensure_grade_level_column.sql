-- Ensure year_level column exists in profiles (grade level for students)
-- Safe to run multiple times — IF NOT EXISTS prevents duplication.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS year_level TEXT;
