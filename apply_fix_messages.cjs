const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Applying migration to fix messages table for groups...');
    
    // We'll try to use a dummy RPC if possible, otherwise we just explain.
    // Since exec is missing, we can't run raw SQL easily without a custom endpoint.
    // But I'll try the common 'exec_sql' or 'run_sql' names if they exist.
    
    const sql = `
      ALTER TABLE IF EXISTS public.messages ALTER COLUMN receiver_id DROP NOT NULL;
      ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS conversation_id text;
      ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS content text;
    `;
    
    console.log('SQL to run:');
    console.log(sql);
    console.log('\nNOTE: If this fails, please run the SQL manually in the Supabase Dashboard SQL Editor.');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        const { error: error2 } = await supabase.rpc('run_sql', { sql });
        if (error2) {
            console.error('Could not apply automatically. Please run manually.');
        } else {
            console.log('✅ Applied successfully via run_sql');
        }
    } else {
        console.log('✅ Applied successfully via exec_sql');
    }

  } catch (error) {
    console.error('Migration failed:', error.message);
  }
}

applyMigration();
