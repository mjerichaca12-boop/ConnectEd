const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sql = `
-- Alter class_announcements table to add is_pinned, link_url, scheduled_at, and status columns
ALTER TABLE IF EXISTS public.class_announcements ADD COLUMN IF NOT EXISTS is_pinned boolean not null default false;
ALTER TABLE IF EXISTS public.class_announcements ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE IF EXISTS public.class_announcements ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE IF EXISTS public.class_announcements ADD COLUMN IF NOT EXISTS status text not null default 'Published';

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'class_announcements_status_check') THEN
    ALTER TABLE public.class_announcements ADD CONSTRAINT class_announcements_status_check CHECK (status IN ('Published', 'Archived', 'Scheduled'));
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
