alter table public.profiles
  add column if not exists provider text;

create table if not exists public.email_verification_tokens (
  id uuid not null default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  token_hash text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  consumed_at timestamp with time zone null,
  constraint email_verification_tokens_pkey primary key (id)
);

create unique index if not exists email_verification_tokens_token_hash_key
  on public.email_verification_tokens using btree (token_hash);

create index if not exists email_verification_tokens_profile_id_idx
  on public.email_verification_tokens using btree (profile_id);

create index if not exists email_verification_tokens_email_idx
  on public.email_verification_tokens using btree (email);
