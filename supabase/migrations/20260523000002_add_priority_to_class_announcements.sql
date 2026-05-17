-- Add the missing priority column to class_announcements

alter table if exists public.class_announcements
add column if not exists priority text;
