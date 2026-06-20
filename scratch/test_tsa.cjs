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
  const { data: tsa } = await supabase
    .from('teacher_student_assignments')
    .select('*')
    .eq('teacher_id', '3c71ddb9-bc6c-4c72-b983-73cdc732ad08')
    .eq('subject_id', '7e23a04a-32b2-4caf-9ed5-834fb4b6b353');
  console.log('Teacher assignments for this subject:', tsa);
}

run();
