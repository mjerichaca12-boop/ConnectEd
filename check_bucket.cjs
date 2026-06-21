const { createClient } = require('@supabase/supabase-js');

// These should match the .env values or the hardcoded ones
const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

// We will read .env.local if available
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkBucket() {
  console.log("Checking buckets...");
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  if (bucketError) {
    console.error("Error listing buckets:", bucketError);
  } else {
    console.log("Buckets:", buckets.map(b => b.name));
    const msgBucket = buckets.find(b => b.name === 'message-attachments');
    if (msgBucket) {
      console.log("Bucket message-attachments exists:", msgBucket);
    } else {
      console.log("Bucket message-attachments DOES NOT EXIST!");
    }
  }
}

checkBucket();
