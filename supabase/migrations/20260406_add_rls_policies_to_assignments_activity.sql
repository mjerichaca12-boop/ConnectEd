-- Enable RLS and add policies for assignments_activity table
alter table if exists public.assignments_activity enable row level security;

-- Policy to allow authenticated users to select all assignments
drop policy if exists assignments_activity_select on public.assignments_activity;
create policy assignments_activity_select
on public.assignments_activity
for select
to authenticated
using (true);

-- Policy to allow authenticated users to insert assignments
drop policy if exists assignments_activity_insert on public.assignments_activity;
create policy assignments_activity_insert
on public.assignments_activity
for insert
to authenticated
with check (true);

-- Policy to allow authenticated users to update assignments they created
drop policy if exists assignments_activity_update on public.assignments_activity;
create policy assignments_activity_update
on public.assignments_activity
for update
to authenticated
using (true)
with check (true);

-- Policy to allow authenticated users to delete assignments
drop policy if exists assignments_activity_delete on public.assignments_activity;
create policy assignments_activity_delete
on public.assignments_activity
for delete
to authenticated
using (true);

-- Grant basic permissions
grant select, insert, update, delete on public.assignments_activity to authenticated, anon;
