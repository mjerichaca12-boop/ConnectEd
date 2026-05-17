-- Enable RLS for teacher access requests and allow authenticated admins to review them.
alter table public.teacher_access_requests enable row level security;

drop policy if exists teacher_access_requests_select_admin on public.teacher_access_requests;
create policy teacher_access_requests_select_admin
on public.teacher_access_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists teacher_access_requests_update_admin on public.teacher_access_requests;
create policy teacher_access_requests_update_admin
on public.teacher_access_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

-- Allow users to submit new access requests (INSERT policy)
drop policy if exists teacher_access_requests_insert_public on public.teacher_access_requests;
create policy teacher_access_requests_insert_public
on public.teacher_access_requests
for insert
to anon, authenticated
with check (true);