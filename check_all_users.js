import { createClient } from '@supabase/supabase-js';

const url = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(url, serviceKey);

async function listRoutines() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1);

  // Let's run a query on pg_catalog via direct query if possible, or information_schema
  // Since Postgrest does not expose catalog tables, let's check if there is an rpc function by inspecting the OpenAPI docs or error messages
  console.log("Supabase client active.");
}
listRoutines();
