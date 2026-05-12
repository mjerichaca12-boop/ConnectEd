const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLS() {
  const sql = `
    ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon, authenticated;
    
    -- Also ensure profiles are accessible
    ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
    
    -- Ensure conversations are accessible
    ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO anon, authenticated;
    
    -- Ensure participants are accessible
    ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO anon, authenticated;
  `;

  console.log('Attempting to fix RLS via rpc("exec")...');
  let result = await supabase.rpc('exec', { sql });
  if (result.error) {
    console.log('rpc("exec") failed:', result.error.message);
    console.log('Attempting to fix RLS via rpc("exec_sql")...');
    result = await supabase.rpc('exec_sql', { sql });
  }
  
  if (result.error) {
    console.log('rpc("exec_sql") failed:', result.error.message);
    console.log('Attempting to fix RLS via rpc("run_sql")...');
    result = await supabase.rpc('run_sql', { sql });
  }

  if (result.error) {
    console.error('Final attempt failed:', result.error.message);
    console.log('Please run the following SQL manually in Supabase SQL Editor:');
    console.log(sql);
  } else {
    console.log('✅ RLS fixed successfully!');
  }
}

fixRLS();
