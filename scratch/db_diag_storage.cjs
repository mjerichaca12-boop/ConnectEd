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
  const { data: policies } = await supabase.rpc('is_teacher_of_class_for_announcements', { p_class_id: '7e23a04a-32b2-4caf-9ed5-834fb4b6b353' });
  console.log('Direct RPC Output without auth context:', policies);
  
  // Query storage.buckets info
  const { data: objects, error } = await supabase.storage.from('class-announcements').list('7e23a04a-32b2-4caf-9ed5-834fb4b6b353');
  console.log('Objects inside class-announcements/7e23a04a-32b2-4caf-9ed5-834fb4b6b353 via Admin Key:', objects, error);
}

run();
