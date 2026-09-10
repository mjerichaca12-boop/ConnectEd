
-- 1. Helper functions for class membership and teacher assignment
create or replace function public.is_teacher_of_class_for_announcements(p_class_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.subjects s
    where s.id = p_class_id
      and s.teacher_id = auth.uid()
  ) or exists (
    select 1
    from public.teacher_student_assignments tsa
    where tsa.subject_id = p_class_id
      and tsa.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_class_member_for_announcements(p_class_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.subjects s
    where s.id = p_class_id
      and s.teacher_id = auth.uid()
  ) or exists (
    select 1
    from public.teacher_student_assignments tsa
    where tsa.subject_id = p_class_id
      and (tsa.teacher_id = auth.uid() or tsa.student_id = auth.uid())
  );
$$;

-- 2. Update RLS policies on public.class_announcements
alter table public.class_announcements enable row level security;

grant select, insert, update, delete on public.class_announcements to authenticated;

drop policy if exists class_announcements_select_members on public.class_announcements;
create policy class_announcements_select_members
on public.class_announcements
for select
to authenticated
using (
  public.is_admin_user()
  or public.is_class_member_for_announcements(class_id)
);

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

-- 3. Update Storage RLS policies for class-announcements bucket
insert into storage.buckets (id, name, public)
values ('class-announcements', 'class-announcements', false)
on conflict (id) do nothing;

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
