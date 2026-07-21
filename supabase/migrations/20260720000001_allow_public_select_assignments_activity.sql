-- Allow public select access to assignments_activity for both anon and authenticated users
drop policy if exists assignments_activity_select on public.assignments_activity;

create policy assignments_activity_select
on public.assignments_activity
for select
to anon, authenticated
using (true);

grant select on public.assignments_activity to anon, authenticated;
