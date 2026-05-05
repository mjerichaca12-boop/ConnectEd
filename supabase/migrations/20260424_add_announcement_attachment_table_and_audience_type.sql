alter table if exists public.announcements
  add column if not exists audience_type text;

do $$
declare
  source_column text;
begin
  select c.column_name
  into source_column
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'announcements'
    and c.column_name in ('target_audience', 'audience', 'target_audience_type', 'recipient_audience')
  order by case c.column_name
    when 'target_audience' then 1
    when 'audience' then 2
    when 'target_audience_type' then 3
    when 'recipient_audience' then 4
    else 99
  end
  limit 1;

  if source_column is not null then
    execute format(
      'update public.announcements
       set audience_type = case
         when lower(trim(coalesce(%1$I::text, ''''))) in (''student'', ''students'') then ''student''
         when lower(trim(coalesce(%1$I::text, ''''))) in (''teacher'', ''teachers'') then ''teacher''
         else ''school''
       end
       where audience_type is null or trim(audience_type) = '''';',
      source_column
    );
  else
    update public.announcements
    set audience_type = 'school'
    where audience_type is null or trim(audience_type) = '';
  end if;
end $$;

alter table if exists public.announcements
  alter column audience_type set default 'school';

alter table if exists public.announcements
  alter column audience_type set not null;

alter table if exists public.announcements
  drop constraint if exists announcements_audience_type_check;

alter table if exists public.announcements
  add constraint announcements_audience_type_check
  check (audience_type in ('student', 'teacher', 'school'));

create index if not exists announcements_audience_type_idx
  on public.announcements (audience_type);

do $$
declare
  announcement_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into announcement_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'announcements'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if announcement_id_type is null then
    raise exception 'Unable to detect public.announcements.id type';
  end if;

  execute format(
    'create table if not exists public.announcement_attachments (
       id uuid primary key default gen_random_uuid(),
       announcement_id %s not null references public.announcements(id) on delete cascade,
       file_url text,
       file_name text,
       file_path text,
       file_type text,
       created_at timestamptz not null default now()
     );',
    announcement_id_type
  );
end $$;

create index if not exists announcement_attachments_announcement_id_idx
  on public.announcement_attachments (announcement_id);

create index if not exists announcement_attachments_created_at_idx
  on public.announcement_attachments (created_at desc);

alter table if exists public.announcement_attachments enable row level security;

grant select, insert, update, delete on public.announcement_attachments to anon, authenticated;

drop policy if exists announcement_attachments_select_all on public.announcement_attachments;
create policy announcement_attachments_select_all
on public.announcement_attachments
for select
to anon, authenticated
using (true);

drop policy if exists announcement_attachments_insert_all on public.announcement_attachments;
create policy announcement_attachments_insert_all
on public.announcement_attachments
for insert
to anon, authenticated
with check (true);

drop policy if exists announcement_attachments_update_all on public.announcement_attachments;
create policy announcement_attachments_update_all
on public.announcement_attachments
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists announcement_attachments_delete_all on public.announcement_attachments;
create policy announcement_attachments_delete_all
on public.announcement_attachments
for delete
to anon, authenticated
using (true);