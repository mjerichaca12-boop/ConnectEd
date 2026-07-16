-- Add RLS policies for conversations and conversation_participants tables

-- Enable RLS on conversations table
alter table public.conversations enable row level security;

-- Policy: Authenticated users can insert conversations (create group chats)
create policy "conversations_insert_authenticated" 
  on public.conversations 
  for insert 
  to authenticated 
  with check (auth.uid() = created_by);

-- Policy: Users can view conversations they are participants in
create policy "conversations_select_participants" 
  on public.conversations 
  for select 
  to authenticated 
  using (
    exists (
      select 1 from public.conversation_participants 
      where conversation_participants.conversation_id = conversations.id 
      and conversation_participants.profile_id = auth.uid()
    )
  );

-- Policy: Conversation creators can update their conversations
create policy "conversations_update_owner" 
  on public.conversations 
  for update 
  to authenticated 
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Enable RLS on conversation_participants table
alter table public.conversation_participants enable row level security;

-- Policy: Authenticated users can insert participants (application logic ensures they are the conversation creator)
create policy "conversation_participants_insert_authenticated" 
  on public.conversation_participants 
  for insert 
  to authenticated 
  with check (true);

-- Policy: Users can view participants for conversations they are in
create policy "conversation_participants_select_participants" 
  on public.conversation_participants 
  for select 
  to authenticated 
  using (conversation_participants.profile_id = auth.uid());

-- Policy: Users can leave conversations (delete their own participation)
create policy "conversation_participants_delete_own" 
  on public.conversation_participants 
  for delete 
  to authenticated 
  using (conversation_participants.profile_id = auth.uid());
