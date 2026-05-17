-- Prevent duplicate teacher subject rows from being created more than once.
-- This keeps the teacher-side subject list stable even if an assignment action is retried.

-- Remove exact duplicates first, keeping the earliest inserted row.
DELETE FROM public.subjects a
USING public.subjects b
WHERE a.ctid < b.ctid
  AND a.teacher_id IS NOT DISTINCT FROM b.teacher_id
  AND lower(btrim(a.code)) = lower(btrim(b.code))
  AND lower(btrim(a.name)) = lower(btrim(b.name));

-- Enforce uniqueness for a teacher's subject rows.
CREATE UNIQUE INDEX IF NOT EXISTS subjects_teacher_code_name_unique
  ON public.subjects (teacher_id, lower(btrim(code)), lower(btrim(name)));
