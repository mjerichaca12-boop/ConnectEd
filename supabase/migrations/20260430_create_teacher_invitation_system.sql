-- Create teacher_access_requests table for pending access requests
create table if not exists public.teacher_access_requests (
  id uuid not null default gen_random_uuid(),
  profile_id uuid,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  middle_name text,
  phone text,
  school_name text,
  position text,
  subjects text[] not null default '{}'::text[],
  additional_info text,
  status text not null default 'pending', -- 'pending', 'approved', 'rejected', 'invited'
  requested_at timestamp with time zone not null default timezone('utc'::text, now()),
  reviewed_at timestamp with time zone,
  reviewed_by text,
  admin_notes text,
  constraint teacher_access_requests_pkey primary key (id),
  constraint teacher_access_requests_status_check check (status in ('pending', 'approved', 'rejected', 'invited')),
  constraint teacher_access_requests_profile_fk foreign key (profile_id) references public.profiles(id) on delete set null
);

-- Create index on email for fast lookups
create index if not exists teacher_access_requests_email_idx
  on public.teacher_access_requests using btree (email);

-- Create index on status for admin filtering
create index if not exists teacher_access_requests_status_idx
  on public.teacher_access_requests using btree (status);

-- Create index on profile_id for profile relationships
create index if not exists teacher_access_requests_profile_id_idx
  on public.teacher_access_requests using btree (profile_id);

-- Create teacher_invitation_tokens table for secure invitation links
create table if not exists public.teacher_invitation_tokens (
  id uuid not null default gen_random_uuid(),
  profile_id uuid,
  email text not null,
  token_hash text not null unique,
  token_plain text not null, -- Store plain token for one-time use in function responses only
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  used_at timestamp with time zone,
  created_by text, -- Admin who sent the invitation
  constraint teacher_invitation_tokens_pkey primary key (id),
  constraint teacher_invitation_tokens_profile_fk foreign key (profile_id) references public.profiles(id) on delete set null
);

-- Create indexes for token lookups
create index if not exists teacher_invitation_tokens_token_hash_idx
  on public.teacher_invitation_tokens using btree (token_hash);

create index if not exists teacher_invitation_tokens_email_idx
  on public.teacher_invitation_tokens using btree (email);

create index if not exists teacher_invitation_tokens_expires_at_idx
  on public.teacher_invitation_tokens using btree (expires_at);

create index if not exists teacher_invitation_tokens_profile_id_idx
  on public.teacher_invitation_tokens using btree (profile_id);

-- Add is_verified column to profiles for invitation-based teachers (if not already exists)
alter table public.profiles
  add column if not exists is_verified boolean default false;

-- Create an index for verifying teachers
create index if not exists profiles_is_verified_idx
  on public.profiles using btree (is_verified)
  where role = 'teacher';
