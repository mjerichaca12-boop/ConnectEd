const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('C:/Users/lych0/Downloads/ConnectEd/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) env[key.trim()] = valueParts.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const sql = `
  SELECT 
    trg.tgname AS trigger_name,
    tbl.relname AS table_name,
    p.proname AS function_name
  FROM pg_trigger trg
  JOIN pg_class tbl ON trg.tgrelid = tbl.oid
  JOIN pg_namespace ns ON tbl.relnamespace = ns.oid
  JOIN pg_proc p ON trg.tgfoid = p.oid
  WHERE ns.nspname = 'public' AND NOT trg.tgisinternal;
`;

async function tryRpc(rpcName) {
  try {
    const { data, error } = await supabase.rpc(rpcName, { sql });
    if (!error) {
      console.log(`Success via ${rpcName}!`);
      console.log('Active Triggers:', data);
      return true;
    }
    console.log(`RPC '${rpcName}' failed:`, error.message);
  } catch (e) {
    console.log(`RPC '${rpcName}' error:`, e.message);
  }
  return false;
}

async function tryFetch(rpcName) {
  try {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.VITE_SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'apikey': env.VITE_SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ sql })
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`Success via Fetch to /rpc/${rpcName}!`);
      console.log('Active Triggers:', data);
      return true;
    }
    console.log(`Fetch to /rpc/${rpcName} failed:`, response.status);
  } catch (e) {
    console.log(`Fetch to /rpc/${rpcName} error:`, e.message);
  }
  return false;
}

async function run() {
  const rpcs = ['exec', 'exec_sql', 'run_sql', 'execute_sql'];
  for (const name of rpcs) {
    if (await tryRpc(name)) return;
  }
  for (const name of rpcs) {
    if (await tryFetch(name)) return;
  }
  console.log('Could not find a working RPC to execute custom SQL.');
}
run();
