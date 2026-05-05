do $$
declare
  school_announcement_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
  into school_announcement_id_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'school_announcements'
    and a.attname = 'id'
    and a.attnum > 0
    and not a.attisdropped
  limit 1;

  if school_announcement_id_type is null then
    raise exception 'Unable to detect public.school_announcements.id type';
  end if;

  execute format(
    'alter table if exists public.announcement_attachments
       add column if not exists school_announcement_id %s;',
    school_announcement_id_type
  );

  execute format(
    'alter table if exists public.announcement_attachments
       alter column announcement_id drop not null;'
  );

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'announcement_attachments'
      and con.conname = 'announcement_attachments_parent_reference_check'
  ) then
    execute format(
      'alter table public.announcement_attachments
         add constraint announcement_attachments_parent_reference_check
         check (announcement_id is not null or school_announcement_id is not null);'
    );
  end if;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'announcement_attachments'
      and con.conname = 'announcement_attachments_school_announcement_id_fkey'
  ) then
    execute format(
      'alter table public.announcement_attachments
         add constraint announcement_attachments_school_announcement_id_fkey
         foreign key (school_announcement_id)
         references public.school_announcements(id)
         on delete cascade;'
    );
  end if;
end $$;

create index if not exists announcement_attachments_school_announcement_id_idx
  on public.announcement_attachments (school_announcement_id);
