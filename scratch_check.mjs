import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve('C:/Users/lych0/Downloads/ConnectEd/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: tables } = await supabase.rpc('get_tables_info'); // Wait, rpc might not exist.
  // Instead, let's just query some common submission tables.
  const checkTable = async (t) => {
    const { data, error } = await supabase.from(t).select('count', { count: 'exact' });
    if (!error) console.log(`Table ${t}: ${data[0].count}`);
    else console.log(`Table ${t} error:`, error.message);
  };
  
  await checkTable('teacher_assessment_submissions');
  await checkTable('submissions');
  await checkTable('assignment_submissions');
  await checkTable('quiz_submissions');
  await checkTable('teacher_assessment_grades');
  await checkTable('grades');
  await checkTable('teacher_student_grades');
}
check();
