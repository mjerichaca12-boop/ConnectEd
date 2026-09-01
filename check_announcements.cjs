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
  const { data: annData, error: annError } = await supabase.from('class_announcements').select('*').limit(1);
  if (annError) {
    console.error('Error fetching class_announcements:', annError);
  } else {
    console.log('Class Announcements columns:', annData.length > 0 ? Object.keys(annData[0]) : 'Empty table');
    console.log('Sample record:', annData[0]);
  }
}
check();
