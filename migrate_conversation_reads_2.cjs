const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
CREATE TABLE IF NOT EXISTS public.conversation_reads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    counterpart_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT conversation_reads_user_conversation_key UNIQUE(user_id, conversation_id),
    CONSTRAINT conversation_reads_user_counterpart_key UNIQUE(user_id, counterpart_id),
    CONSTRAINT check_conversation_target CHECK (
        (conversation_id IS NOT NULL AND counterpart_id IS NULL) OR
        (conversation_id IS NULL AND counterpart_id IS NOT NULL)
    )
);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_reads' AND policyname = 'Enable all for users') THEN
        CREATE POLICY "Enable all for users" ON public.conversation_reads FOR ALL USING (true) WITH CHECK (true);
    END IF;
END
$$;
`;

async function tryRpc(rpcName) {
  try {
    const { error } = await supabase.rpc(rpcName, { sql });
    if (!error) return true;
  } catch (e) {}
  return false;
}

async function run() {
  const endpoints = ['exec', 'exec_sql', 'run_sql'];
  for (const name of endpoints) {
    if (await tryRpc(name)) {
      console.log(`Success via RPC '${name}'`);
      process.exit(0);
    }
  }
  console.log('Failed');
  process.exit(1);
}

run();
