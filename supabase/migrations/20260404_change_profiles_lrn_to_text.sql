alter table public.profiles
  alter column lrn type text
  using lrn::text;