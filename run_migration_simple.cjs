const { createClient } = require('@supabase/supabase-js');

// Environment variables - replace with actual values if needed
const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Testing if conversation_id column exists...');
    
    // Test if the column exists by trying to select it
    const { data, error } = await supabase
      .from('messages')
      .select('conversation_id')
      .limit(1);
    
    if (error) {
      console.log('Error detected:', error.message);
      
      if (error.message.includes('column "conversation_id" does not exist')) {
        console.log('');
        console.log('❌ The conversation_id column is missing from the messages table.');
        console.log('');
        console.log('🔧 TO FIX THIS, run the following SQL in your Supabase dashboard:');
        console.log('');
        console.log('-- Go to Supabase Dashboard -> SQL Editor and run:');
        console.log('ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS conversation_id text;');
        console.log('');
        console.log('ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;');
        console.log('');
        console.log('CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id);');
        console.log('');
        console.log('Or if you have Supabase CLI installed, run:');
        console.log('supabase db push');
      } else {
        console.log('Different error occurred:', error);
      }
    } else {
      console.log('✅ conversation_id column exists! Migration appears to be applied.');
    }
    
  } catch (error) {
    console.error('Migration check failed:', error);
  }
}

runMigration();
