-- Fix existing quiz records that were saved with type='assignment' but have quiz indicators
-- Update any record where title contains 'Quiz' to have assessment_type='quiz'
UPDATE public.assignments_activity 
SET assessment_type = 'quiz',
    type = 'quiz',
    activity_type = 'quiz',
    task_type = 'quiz'
WHERE (title ILIKE '%quiz%' OR description ILIKE '%question%' OR description ILIKE '%answer key%')
  AND assessment_type IS DISTINCT FROM 'quiz'
  AND (type IS NULL OR type != 'quiz');

-- Ensure all quizzes have type='quiz' across all possible type columns
UPDATE public.assignments_activity 
SET type = 'quiz',
    activity_type = 'quiz',
    task_type = 'quiz'
WHERE assessment_type = 'quiz'
  AND (type != 'quiz' OR activity_type != 'quiz' OR task_type != 'quiz');
