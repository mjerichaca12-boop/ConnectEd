
-- Migration: 20260910000002_fix_messages_rls.sql
-- Fix Messages, Groupchats, Conversations, and Participants RLS

-- 1. Helper function for conversation membership (SECURITY DEFINER to avoid RLS recursion)
create or replace function public.is_conversation_member(p_conversation_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.profile_id = auth.uid()
  ) or exists (
    select 1
    from public.conversations c
    where c.id = p_conversation_id
      and c.created_by = auth.uid()
  ) or exists (
    select 1
    from public.groupchats gc
    where gc.id = p_conversation_id
      and gc.created_by = auth.uid()
  ) or public.is_admin_user();
$$;

-- 2. Groupchats RLS policies
alter table if exists public.groupchats enable row level security;
grant select, insert, update, delete on public.groupchats to authenticated;

drop policy if exists groupchats_select_policy on public.groupchats;
create policy groupchats_select_policy on public.groupchats
for select to authenticated
using (
  public.is_admin_user()
  or created_by = auth.uid()
  or public.is_conversation_member(id)
);

drop policy if exists groupchats_insert_policy on public.groupchats;
create policy groupchats_insert_policy on public.groupchats
for insert to authenticated
with check (
  public.is_admin_user()
  or created_by is null
  or created_by = auth.uid()
);

drop policy if exists groupchats_update_policy on public.groupchats;
create policy groupchats_update_policy on public.groupchats
for update to authenticated
using (
  public.is_admin_user()
  or created_by = auth.uid()
  or public.is_conversation_member(id)
);

-- 3. Conversations RLS policies
alter table if exists public.conversations enable row level security;
grant select, insert, update, delete on public.conversations to authenticated;

drop policy if exists conversations_select_policy on public.conversations;
create policy conversations_select_policy on public.conversations
for select to authenticated
using (
  public.is_admin_user()
  or created_by = auth.uid()
  or public.is_conversation_member(id)
);

drop policy if exists conversations_insert_policy on public.conversations;
create policy conversations_insert_policy on public.conversations
for insert to authenticated
with check (
  public.is_admin_user()
  or created_by is null
  or created_by = auth.uid()
);

-- 4. Conversation Participants RLS policies
alter table if exists public.conversation_participants enable row level security;
grant select, insert, update, delete on public.conversation_participants to authenticated;

drop policy if exists conversation_participants_select_policy on public.conversation_participants;
create policy conversation_participants_select_policy on public.conversation_participants
for select to authenticated
using (
  public.is_admin_user()
  or profile_id = auth.uid()
  or public.is_conversation_member(conversation_id)
);

drop policy if exists conversation_participants_insert_policy on public.conversation_participants;
create policy conversation_participants_insert_policy on public.conversation_participants
for insert to authenticated
with check (
  public.is_admin_user()
  or profile_id = auth.uid()
  or public.is_conversation_member(conversation_id)
);

-- 5. Messages RLS policies
alter table if exists public.messages enable row level security;
grant select, insert, update, delete on public.messages to authenticated;

drop policy if exists messages_select_members on public.messages;
create policy messages_select_members on public.messages
for select to authenticated
using (
  public.is_admin_user()
  or sender_id = auth.uid()
  or receiver_id = auth.uid()
  or (conversation_id is not null and public.is_conversation_member(conversation_id))
);

drop policy if exists messages_insert_sender_member on public.messages;
drop policy if exists messages_insert_all on public.messages;
drop policy if exists "Users can send messages." on public.messages;

create policy messages_insert_sender_member on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    public.is_admin_user()
    or receiver_id is not null
    or (conversation_id is not null and public.is_conversation_member(conversation_id))
  )
);

drop policy if exists messages_update_owner_or_receiver on public.messages;
create policy messages_update_owner_or_receiver on public.messages
for update to authenticated
using (
  public.is_admin_user()
  or sender_id = auth.uid()
  or receiver_id = auth.uid()
);

drop policy if exists messages_delete_owner on public.messages;
create policy messages_delete_owner on public.messages
for delete to authenticated
using (
  public.is_admin_user()
  or sender_id = auth.uid()
);
