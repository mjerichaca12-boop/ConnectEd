const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

async function fixRLS() {
  const sql = `
    ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO anon, authenticated;
    ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
    ALTER TABLE public.conversations DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO anon, authenticated;
    ALTER TABLE public.conversation_participants DISABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO anon, authenticated;
  `;

  console.log('Attempting direct fetch to /rest/v1/rpc/exec_sql...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql })
    });

    if (response.ok) {
      console.log('✅ RLS fixed via exec_sql!');
    } else {
      const error = await response.text();
      console.log('exec_sql failed:', response.status, error);
      
      console.log('Trying /rest/v1/rpc/exec...');
      const response2 = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ sql })
      });
      
      if (response2.ok) {
        console.log('✅ RLS fixed via exec!');
      } else {
        console.log('exec failed:', response2.status, await response2.text());
      }
    }
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

fixRLS();
