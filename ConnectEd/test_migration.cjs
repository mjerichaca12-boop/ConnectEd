const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testMigration() {
  try {
    console.log('Testing if conversation_id column exists...');
    
    // Test if the column exists by trying to select it
    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id')
      .limit(1);
    
    if (error) {
      console.log('❌ Error:', error.message);
      console.log('');
      console.log('The migration still needs to be applied manually.');
      console.log('Go to: https://pyeckxqaowusxcmeuolk.supabase.co/project/sql');
      console.log('');
      console.log('Run this SQL:');
      console.log('ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS conversation_id text;');
      console.log('ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;');
      console.log('CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id);');
    } else {
      console.log('✅ Success! conversation_id column is available.');
      console.log('Sample data:', data);
      console.log('');
      console.log('Your messaging should now work correctly!');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testMigration();
