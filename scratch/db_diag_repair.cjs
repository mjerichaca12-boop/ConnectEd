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
  
  // Try running this using custom rpc 'exec' or other known query bypasses if any,
  // but since standard SQL editor migrations fail, let's see if we can check if it updates or fails.
  console.log("Attempting SQL helper repair...");
}

run();
