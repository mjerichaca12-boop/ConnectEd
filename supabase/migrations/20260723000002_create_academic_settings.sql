-- Migration: Create academic_settings table
-- Date: 2026-07-23

create table if not exists public.academic_settings (
    id integer primary key default 1,
    current_school_year text not null default '2026-2027',
    current_quarter text not null default '1st Quarter',
    updated_at timestamp with time zone default now(),
    updated_by uuid references public.profiles(id),
    
    constraint single_row check (id = 1)
);

-- Enable RLS
alter table public.academic_settings enable row level security;

-- Policies
create policy "Allow read access for all authenticated users"
    on public.academic_settings
    for select
    to authenticated
    using (true);

create policy "Allow all access for admins"
    on public.academic_settings
    for all
    to authenticated
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    )
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

-- Insert default row if not exists
insert into public.academic_settings (id, current_school_year, current_quarter)
values (1, '2026-2027', '1st Quarter')
on conflict (id) do nothing;

notify pgrst, 'reload schema';
