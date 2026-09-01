-- Class announcements system with attachment support and scoped storage access

create table if not exists public.class_announcements (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.subjects(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  title text not null,
  content text,
  author text,
  created_by_name text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_class_announcements_class_id_created_at
  on public.class_announcements(class_id, created_at desc);

create index if not exists idx_class_announcements_teacher_id
  on public.class_announcements(teacher_id);

create index if not exists idx_class_announcements_attachments_gin
  on public.class_announcements using gin (attachments);

create or replace function public.set_class_announcements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_class_announcements_updated_at on public.class_announcements;
create trigger trg_set_class_announcements_updated_at
before update on public.class_announcements
for each row
execute function public.set_class_announcements_updated_at();

create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'admin'
  );
$$;

create or replace function public.is_class_member_for_announcements(p_class_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.teacher_student_assignments tsa
    where tsa.subject_id = p_class_id
      and (tsa.teacher_id = auth.uid() or tsa.student_id = auth.uid())
  );
$$;

create or replace function public.is_teacher_of_class_for_announcements(p_class_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.teacher_student_assignments tsa
    where tsa.subject_id = p_class_id
      and tsa.teacher_id = auth.uid()
  );
$$;

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
)
with check (
  public.is_admin_user()
  or teacher_id = auth.uid()
);

drop policy if exists class_announcements_delete_owner_admin on public.class_announcements;
create policy class_announcements_delete_owner_admin
on public.class_announcements
for delete
to authenticated
using (
  public.is_admin_user()
  or teacher_id = auth.uid()
);

insert into storage.buckets (id, name, public)
values ('class-announcements', 'class-announcements', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id = 'class-announcements';

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

alter table public.class_announcements replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'class_announcements'
  ) then
    alter publication supabase_realtime add table public.class_announcements;
  end if;
end;
$$;
