-- Remove duplicate subject assignment rows per teacher/subject identity,
-- then enforce uniqueness so duplicate cards cannot reappear on teacher pages.

WITH ranked_subjects AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        teacher_id,
        lower(btrim(code)),
        lower(btrim(name)),
        lower(btrim(coalesce(section, '')))
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS duplicate_rank
  FROM public.subjects
)
DELETE FROM public.subjects s
USING ranked_subjects rs
WHERE s.id = rs.id
  AND rs.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_teacher_code_name_section_unique
  ON public.subjects (
    teacher_id,
    lower(btrim(code)),
    lower(btrim(name)),
    lower(btrim(coalesce(section, '')))
  )
  WHERE teacher_id IS NOT NULL;
