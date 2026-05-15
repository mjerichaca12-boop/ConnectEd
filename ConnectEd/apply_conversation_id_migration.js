const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Applying conversation_id migration...');
    
    // Add conversation_id column if it doesn't exist
    const { error: addColumnError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE IF EXISTS public.messages 
        ADD COLUMN IF NOT EXISTS conversation_id text;
      `
    });
    
    if (addColumnError) {
      console.error('Error adding conversation_id column:', addColumnError);
    } else {
      console.log('✓ conversation_id column added (or already exists)');
    }
    
    // Add foreign key constraint if it doesn't exist
    const { error: addFKError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    
    if (addFKError) {
      console.error('Error adding foreign key constraint:', addFKError);
    } else {
      console.log('✓ Foreign key constraint added (or already exists)');
    }
    
    // Create index if it doesn't exist
    const { error: addIndexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS messages_conversation_idx 
        ON public.messages (conversation_id);
      `
    });
    
    if (addIndexError) {
      console.error('Error creating index:', addIndexError);
    } else {
      console.log('✓ Index created (or already exists)');
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

applyMigration();
