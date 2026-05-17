-- Add INSERT policy for teacher_access_requests to allow unauthenticated submissions
-- This allows users to submit access requests via the request-access Edge Function

-- Anonymous/public users can INSERT new teacher access requests
create policy teacher_access_requests_insert_public
on public.teacher_access_requests
for insert
to anon, authenticated
with check (true);
