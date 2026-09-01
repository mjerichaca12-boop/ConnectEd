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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('subjects').select('*').limit(1);
  if (error) {
    console.error('Error fetching subjects:', error);
  } else {
    console.log('Subjects columns:', data.length > 0 ? Object.keys(data[0]) : 'No records found');
  }
}
check();
