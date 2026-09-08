const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suffix TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles (employee_id) WHERE role = 'teacher' AND employee_id IS NOT NULL;
`;

async function tryRpc(rpcName) {
  try {
    console.log(`Trying RPC '${rpcName}'...`);
    const { data, error } = await supabase.rpc(rpcName, { sql });
    if (!error) {
      console.log(`RPC '${rpcName}' succeeded!`, data);
      return true;
    }
    console.log(`RPC '${rpcName}' returned error:`, error.message);
  } catch (e) {
    console.log(`RPC '${rpcName}' exception:`, e.message);
  }
  return false;
}

async function tryFetch(rpcName) {
  try {
    console.log(`Trying Fetch to /rpc/${rpcName}...`);
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql })
    });
    if (response.ok) {
      console.log(`Fetch '${rpcName}' succeeded!`);
      return true;
    }
    const txt = await response.text();
    console.log(`Fetch '${rpcName}' failed status ${response.status}:`, txt);
  } catch (e) {
    console.log(`Fetch '${rpcName}' exception:`, e.message);
  }
  return false;
}

async function run() {
  const endpoints = ['exec', 'exec_sql', 'run_sql', 'execute_sql'];
  for (const name of endpoints) {
    if (await tryRpc(name)) process.exit(0);
  }
  for (const name of endpoints) {
    if (await tryFetch(name)) process.exit(0);
  }
  console.log('All attempts completed.');
}

run();
