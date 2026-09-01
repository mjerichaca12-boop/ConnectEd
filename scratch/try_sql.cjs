const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    val = val.trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.substring(1, val.length - 1);
    env[match[1]] = val.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const sql = `
create or replace function public.is_teacher_of_class_for_announcements(p_class_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.subjects s
    where s.id = p_class_id
      and s.teacher_id = auth.uid()
  ) or exists (
    select 1
    from public.teacher_student_assignments tsa
    where tsa.subject_id = p_class_id
      and tsa.teacher_id = auth.uid()
  );
$$;
`;

async function tryFetch(rpcName) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ query: sql, sql: sql })
    });
    if (response.ok) {
      console.log(`✅ Success via /rpc/${rpcName}`);
      return true;
    }
    const text = await response.text();
    console.log(`Fetch to /rpc/${rpcName} failed: status=${response.status}, body=${text}`);
  } catch (e) {
    console.log(`Fetch to /rpc/${rpcName} error:`, e.message);
  }
  return false;
}

async function run() {
  const endpoints = ['exec', 'exec_sql', 'run_sql', 'execute_sql'];
  for (const name of endpoints) {
    if (await tryFetch(name)) {
      console.log("SQL successfully updated!");
      process.exit(0);
    }
  }
  console.log("All manual execution endpoints failed.");
}

run();
