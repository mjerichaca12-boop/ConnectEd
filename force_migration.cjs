const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Add category column to announcements and school_announcements tables
ALTER TABLE IF EXISTS public.announcements ADD COLUMN IF NOT EXISTS category text DEFAULT 'General';
ALTER TABLE IF EXISTS public.school_announcements ADD COLUMN IF NOT EXISTS category text DEFAULT 'General';

-- Add constraints
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_category_check') THEN
    ALTER TABLE public.announcements ADD CONSTRAINT announcements_category_check CHECK (category IN ('General', 'Lesson Plan', 'Task', 'School Info'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'school_announcements_category_check') THEN
    ALTER TABLE public.school_announcements ADD CONSTRAINT school_announcements_category_check CHECK (category IN ('General', 'Lesson Plan', 'Task', 'School Info'));
  END IF;
END $$;
`;

async function tryRpc(rpcName) {
  try {
    console.log(`Trying RPC '${rpcName}'...`);
    const { error } = await supabase.rpc(rpcName, { sql });
    if (!error) return true;
    console.log(`RPC '${rpcName}' failed:`, error.message);
  } catch (e) {
    console.log(`RPC '${rpcName}' error:`, e.message);
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
    if (response.ok) return true;
    console.log(`Fetch to /rpc/${rpcName} failed:`, response.status);
  } catch (e) {
    console.log(`Fetch to /rpc/${rpcName} error:`, e.message);
  }
  return false;
}

async function run() {
  const endpoints = ['exec', 'exec_sql', 'run_sql'];
  
  for (const name of endpoints) {
    if (await tryRpc(name)) {
      console.log(`✅ Success via RPC '${name}'`);
      process.exit(0);
    }
  }

  for (const name of endpoints) {
    if (await tryFetch(name)) {
      console.log(`✅ Success via Fetch to '${name}'`);
      process.exit(0);
    }
  }

  console.log('❌ All automated migration attempts failed.');
  console.log('Please run the following SQL manually in your Supabase SQL Editor:');
  console.log('https://pyeckxqaowusxcmeuolk.supabase.co/project/sql');
  console.log('\n' + sql + '\n');
  process.exit(1);
}

run();
