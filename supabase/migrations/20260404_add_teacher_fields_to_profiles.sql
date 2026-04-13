alter table public.profiles
	add column if not exists subjects text[] not null default '{}'::text[],
	add column if not exists assigned_class text,
	add column if not exists updated_at timestamptz not null default now();

create unique index if not exists profiles_teacher_assigned_class_unique
	on public.profiles (assigned_class)
	where role = 'teacher' and assigned_class is not null and assigned_class <> '';

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists trigger_set_profiles_updated_at on public.profiles;

create trigger trigger_set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

do $$
begin
	if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
		execute 'alter publication supabase_realtime add table public.profiles';
	end if;
end $$;
