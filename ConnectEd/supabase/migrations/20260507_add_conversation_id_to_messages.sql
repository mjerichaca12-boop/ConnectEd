-- Adds conversation_id to messages so messages can be linked to conversations

alter table if exists public.messages
  add column if not exists conversation_id text;

alter table if exists public.messages
  add constraint messages_conversation_fk foreign key (conversation_id) references public.conversations(id) on delete set null;

create index if not exists messages_conversation_idx on public.messages (conversation_id);

-- Grant and RLS policies are inherited from messages; ensure inserts with conversation_id are allowed

