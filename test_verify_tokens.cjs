const { createClient } = require('@supabase/supabase-js');

const url = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabaseAdmin = createClient(url, serviceKey);

async function testTokens() {
  console.log("Querying email_verification_tokens...");
  const { data, error } = await supabaseAdmin
    .from("email_verification_tokens")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Error querying email_verification_tokens:", error);
  } else {
    console.log("Success! Data:", data);
  }
}

testTokens();
