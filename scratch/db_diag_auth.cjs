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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: user } = await supabase.from('profiles').select('*').eq('id', '3c71ddb9-bc6c-4c72-b983-73cdc732ad08').single();
  console.log('Profile row:', user);
  const { data: tsa } = await supabase.from('teacher_student_assignments').select('*').eq('teacher_id', '3c71ddb9-bc6c-4c72-b983-73cdc732ad08');
  console.log('Teacher assignments count:', tsa ? tsa.length : 0);
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  console.log('Auth users list:', authUsers.users.map(u => ({ id: u.id, email: u.email })));
}

run();
