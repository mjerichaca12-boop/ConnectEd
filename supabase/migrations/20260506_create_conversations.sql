-- Creates conversations and conversation_participants tables for group chat support

create table if not exists public.conversations (
  id text primary key,
  name text,
  is_group boolean default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id text not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  is_admin boolean default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, profile_id)
);

grant select, insert, update, delete on public.conversations to anon, authenticated;
grant select, insert, update, delete on public.conversation_participants to anon, authenticated;

-- Basic RLS policies allowing participants access will need review in production

