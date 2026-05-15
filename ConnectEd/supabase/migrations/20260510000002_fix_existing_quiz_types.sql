-- Fix existing quiz records that were saved with type='assignment' but have quiz indicators
-- Update any record where title contains 'Quiz' to have assessment_type='quiz'
UPDATE public.assignments_activity 
SET assessment_type = 'quiz'
WHERE (title ILIKE '%quiz%' OR description ILIKE '%question%' OR description ILIKE '%answer key%')
  AND assessment_type IS DISTINCT FROM 'quiz';

-- Ensure all quizzes have assessment_type='quiz'
UPDATE public.assignments_activity 
SET assessment_type = 'quiz'
WHERE title ILIKE '%quiz%' OR description ILIKE '%question%' OR description ILIKE '%answer key%';
