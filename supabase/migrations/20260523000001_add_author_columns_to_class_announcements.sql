-- Add missing author and created_by_name columns to class_announcements if they don't exist

alter table if exists public.class_announcements
add column if not exists author text;

alter table if exists public.class_announcements
add column if not exists created_by_name text;
