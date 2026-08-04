import { createClient } from '@supabase/supabase-js';

const url = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(url, serviceKey);

async function listAll() {
  const { data: profiles, error: pError } = await supabase.from('profiles').select('id, email, username, first_name, last_name');
  if (pError) console.error(pError);
  else console.log('=== PROFILES ===\n', profiles);

  const { data: { users }, error: uError } = await supabase.auth.admin.listUsers();
  if (uError) console.error(uError);
  else console.log('=== AUTH USERS ===\n', users.map(u => ({ id: u.id, email: u.email })));
}

listAll();
