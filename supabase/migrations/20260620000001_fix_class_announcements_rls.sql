-- =============================================================================
-- COMPLETE FIX: class_announcements RLS policies
-- =============================================================================
-- ROOT CAUSE: The original is_teacher_of_class_for_announcements() function
-- only checks teacher_student_assignments.teacher_id = auth.uid().
-- Teachers who OWN a class are stored in subjects.teacher_id, NOT necessarily
-- in teacher_student_assignments. This causes every INSERT to fail with RLS.
--
-- FIX: Rewrite the helper functions to also check subjects.teacher_id.
-- Use SECURITY DEFINER so the function can bypass RLS on subjects/profiles.
-- =============================================================================

-- ─── 1. Rewrite is_teacher_of_class_for_announcements ─────────────────────────
-- Checks: TSA membership OR direct subjects.teacher_id ownership

create or replace function public.is_teacher_of_class_for_announcements(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    -- Path A: Teacher has a row in teacher_student_assignments for this subject
    exists (
      select 1
      from public.teacher_student_assignments tsa
      where tsa.subject_id = p_class_id
        and tsa.teacher_id = auth.uid()
    )
    or
    -- Path B: Teacher directly owns the subject (subjects.teacher_id)
    exists (
      select 1
      from public.subjects s
      where s.id = p_class_id
        and s.teacher_id = auth.uid()
    )
  );
$$;

-- ─── 2. Rewrite is_class_member_for_announcements ─────────────────────────────
-- Checks: TSA membership (student or teacher) OR subjects.teacher_id ownership

create or replace function public.is_class_member_for_announcements(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    exists (
      select 1
      from public.teacher_student_assignments tsa
      where tsa.subject_id = p_class_id
        and (tsa.teacher_id = auth.uid() or tsa.student_id = auth.uid())
    )
    or
    exists (
      select 1
      from public.subjects s
      where s.id = p_class_id
        and s.teacher_id = auth.uid()
    )
  );
$$;

-- ─── 3. Rewrite is_admin_user (idempotent, make security definer) ─────────────

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  );
$$;

-- ─── 4. Drop and recreate all class_announcements TABLE policies ───────────────

-- SELECT: members (teacher or student) and admins can read
drop policy if exists class_announcements_select_members on public.class_announcements;
create policy class_announcements_select_members
on public.class_announcements
for select
to authenticated
using (
  public.is_admin_user()
  or public.is_class_member_for_announcements(class_id)
);

-- INSERT: only teachers of the class (via TSA or subjects.teacher_id) can create
drop policy if exists class_announcements_insert_teachers_admins on public.class_announcements;
create policy class_announcements_insert_teachers_admins
on public.class_announcements
for insert
to authenticated
with check (
  (
    public.is_admin_user()
    or public.is_teacher_of_class_for_announcements(class_id)
  )
  and (
    public.is_admin_user()
    or teacher_id is null
    or teacher_id = auth.uid()
  )
);

-- UPDATE: only the announcement owner or admins
drop policy if exists class_announcements_update_owner_admin on public.class_announcements;
create policy class_announcements_update_owner_admin
on public.class_announcements
for update
to authenticated
using (
  public.is_admin_user()
  or teacher_id = auth.uid()
  or public.is_teacher_of_class_for_announcements(class_id)
)
with check (
  public.is_admin_user()
  or teacher_id = auth.uid()
  or public.is_teacher_of_class_for_announcements(class_id)
);

-- DELETE: only the announcement owner or admins
drop policy if exists class_announcements_delete_owner_admin on public.class_announcements;
create policy class_announcements_delete_owner_admin
on public.class_announcements
for delete
to authenticated
using (
  public.is_admin_user()
  or teacher_id = auth.uid()
  or public.is_teacher_of_class_for_announcements(class_id)
);

-- ─── 5. Drop and recreate STORAGE policies for class-announcements bucket ──────
-- Storage path format: <class_uuid>/<teacher_uuid>/<filename>
-- split_part(name, '/', 1) = class UUID → verified against is_teacher_of_class_for_announcements

drop policy if exists class_announcements_storage_select_members on storage.objects;
create policy class_announcements_storage_select_members
on storage.objects
for select
to authenticated
using (
  bucket_id = 'class-announcements'
  and (
    public.is_admin_user()
    or (
      split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.is_class_member_for_announcements((split_part(name, '/', 1))::uuid)
    )
  )
);

drop policy if exists class_announcements_storage_insert_teachers_admins on storage.objects;
create policy class_announcements_storage_insert_teachers_admins
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'class-announcements'
  and (
    public.is_admin_user()
    or (
      split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.is_teacher_of_class_for_announcements((split_part(name, '/', 1))::uuid)
    )
  )
);

drop policy if exists class_announcements_storage_update_teachers_admins on storage.objects;
create policy class_announcements_storage_update_teachers_admins
on storage.objects
for update
to authenticated
using (
  bucket_id = 'class-announcements'
  and (
    public.is_admin_user()
    or (
      split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.is_teacher_of_class_for_announcements((split_part(name, '/', 1))::uuid)
    )
  )
)
with check (
  bucket_id = 'class-announcements'
  and (
    public.is_admin_user()
    or (
      split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.is_teacher_of_class_for_announcements((split_part(name, '/', 1))::uuid)
    )
  )
);

drop policy if exists class_announcements_storage_delete_teachers_admins on storage.objects;
create policy class_announcements_storage_delete_teachers_admins
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'class-announcements'
  and (
    public.is_admin_user()
    or (
      split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and public.is_teacher_of_class_for_announcements((split_part(name, '/', 1))::uuid)
    )
  )
);

-- ─── 6. Verify the fix by confirming function definitions ─────────────────────
-- You can test by running: SELECT public.is_teacher_of_class_for_announcements('<your_class_uuid>');
-- while authenticated as a teacher.
