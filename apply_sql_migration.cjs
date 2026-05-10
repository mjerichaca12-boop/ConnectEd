const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Applying migration to add conversation_id column...');
    
    // Use the RPC function to execute raw SQL
    const { data, error } = await supabase.rpc('exec', {
      sql: `
        ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS conversation_id text;
        
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'messages_conversation_fk' 
            AND table_name = 'messages' 
            AND table_schema = 'public'
          ) THEN
            ALTER TABLE public.messages 
            ADD CONSTRAINT messages_conversation_fk 
            FOREIGN KEY (conversation_id) 
            REFERENCES public.conversations(id) 
            ON DELETE SET NULL;
          END IF;
        END $$;
        
        CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id);
      `
    });
    
    if (error) {
      console.log('RPC exec not available, trying direct method...');
      
      // Try a different approach - use the _raw SQL endpoint
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({
          sql: `
            ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS conversation_id text;
            
            DO $$ 
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = 'messages_conversation_fk' 
                AND table_name = 'messages' 
                AND table_schema = 'public'
              ) THEN
                ALTER TABLE public.messages 
                ADD CONSTRAINT messages_conversation_fk 
                FOREIGN KEY (conversation_id) 
                REFERENCES public.conversations(id) 
                ON DELETE SET NULL;
              END IF;
            END $$;
            
            CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id);
          `
        })
      });
      
      if (response.ok) {
        console.log('✅ Migration applied successfully!');
      } else {
        console.log('❌ Could not apply migration automatically.');
        console.log('');
        console.log('Please run this SQL manually in your Supabase dashboard:');
        console.log('https://pyeckxqaowusxcmeuolk.supabase.co/project/sql');
        console.log('');
        console.log('SQL to run:');
        console.log('ALTER TABLE IF EXISTS public.messages ADD COLUMN IF NOT EXISTS conversation_id text;');
        console.log('ALTER TABLE public.messages ADD CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;');
        console.log('CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages (conversation_id);');
      }
    } else {
      console.log('✅ Migration applied successfully!');
    }
    
    // Verify the migration worked
    const { data: testData, error: testError } = await supabase
      .from('messages')
      .select('conversation_id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Migration verification failed:', testError.message);
    } else {
      console.log('✅ conversation_id column is now available!');
    }
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    console.log('');
    console.log('Please run the SQL manually in your Supabase dashboard:');
    console.log('https://pyeckxqaowusxcmeuolk.supabase.co/project/sql');
  }
}

applyMigration();
