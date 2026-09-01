-- Migration: Add term to assignments and quizzes
-- Date: 2026-07-23

alter table if exists public.assignments
add column if not exists term text default '1st Quarter';

alter table if exists public.quizzes
add column if not exists term text default '1st Quarter';

notify pgrst, 'reload schema';
