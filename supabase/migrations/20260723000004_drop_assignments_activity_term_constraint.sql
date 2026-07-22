-- Migration: Alter assignments_activity check constraint
-- Date: 2026-07-23

alter table if exists public.assignments_activity
drop constraint if exists assignments_activity_term_check;

notify pgrst, 'reload schema';
