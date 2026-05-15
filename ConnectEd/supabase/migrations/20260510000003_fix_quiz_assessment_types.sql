-- Fix quiz records that are incorrectly marked as 'assignment' instead of 'quiz'
-- Update the specific record and any others with quiz indicators

-- Update the specific quiz record to have assessment_type='quiz'
UPDATE public.assignments_activity 
SET assessment_type = 'quiz'
WHERE id = 'c90aba5d-0dfd-48c3-a041-53d5beec9b9f'
  AND assessment_type != 'quiz';

-- Fix any other quiz records based on title/description patterns
UPDATE public.assignments_activity 
SET assessment_type = 'quiz'
WHERE (title ILIKE '%quiz%' OR title ILIKE '%test%' OR description ILIKE '%question%' OR description ILIKE '%answer key%')
  AND assessment_type = 'assignment'
  AND id != 'c90aba5d-0dfd-48c3-a041-53d5beec9b9f';

-- Verify the fix
SELECT id, title, assessment_type FROM public.assignments_activity 
WHERE id = 'c90aba5d-0dfd-48c3-a041-53d5beec9b9f';
