-- Add update tracking columns to assignments_activity table
alter table if exists public.assignments_activity
add column if not exists updated_at timestamptz,
add column if not exists updated_by uuid;

-- Create an index on updated_at for sorting by recent updates
create index if not exists assignments_activity_updated_at_idx
  on public.assignments_activity (updated_at desc);
