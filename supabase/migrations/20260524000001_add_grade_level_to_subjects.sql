-- Adds canonical grade_level column to subjects
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS grade_level TEXT DEFAULT '';

-- Optional: ensure not null
ALTER TABLE public.subjects
ALTER COLUMN grade_level SET NOT NULL;

-- You may want to add a CHECK constraint in the future to restrict values.
