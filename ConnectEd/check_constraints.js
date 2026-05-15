import { createClient } from '@supabase/supabase-js';

const url = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(url, serviceKey);

async function checkConstraints() {
  const sql = `
    SELECT column_name, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'receiver_id';
  `;
  
  const { data, error } = await supabase.rpc('exec', { sql });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Receiver ID Nullability:', data);
  }
}

checkConstraints();
