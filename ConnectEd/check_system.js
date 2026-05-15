
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function checkSystem() {
  console.log('🚀 Starting System Diagnostic...\n');

  // 1. Read .env
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found');
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value) {
      env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });

  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    console.error('❌ Supabase URL or Anon Key missing in .env');
    return;
  }

  console.log('✅ Found Supabase Configuration');
  
  const supabase = createClient(url, anonKey);
  const supabaseAdmin = serviceKey ? createClient(url, serviceKey) : null;

  if (!supabaseAdmin) {
    console.warn('⚠️ Service Role Key missing. Cannot test User Creation (Auth).');
  } else {
    console.log('✅ Service Role Key found.');
  }

  const tablesToCheck = [
    'profiles',
    'announcements',
    'school_calendar_events',
    'messages',
    'conversations',
    'class_materials'
  ];

  console.log('\n📊 Checking Tables:');
  for (const table of tablesToCheck) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST116' || error.code === 'PGRST204') {
         // Empty table is fine
         console.log(`✅ Table '${table}' exists (empty)`);
      } else if (error.code === '42P01') {
         console.error(`❌ Table '${table}' DOES NOT EXIST`);
      } else {
         console.error(`❌ Table '${table}' error: ${error.message} (Code: ${error.code})`);
      }
    } else {
      console.log(`✅ Table '${table}' exists and is accessible`);
    }
  }

  // Check RLS on profiles
  console.log('\n🔐 Testing RLS / Insert on Profiles:');
  const testId = '00000000-0000-0000-0000-000000000001';
  const { error: insertError } = await supabase.from('profiles').insert({
    id: testId,
    first_name: 'Test',
    last_name: 'User',
    role: 'student',
    email: 'test@example.com'
  });

  if (insertError) {
    console.error(`❌ Profiles Insert Failed: ${insertError.message}`);
  } else {
    console.log('✅ Profiles Insert Successful (RLS allows anon/authenticated insert)');
    // Cleanup
    await supabase.from('profiles').delete().eq('id', testId);
  }

  console.log('\n🏁 Diagnostic Complete.');
}

checkSystem();
