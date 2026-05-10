const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running messages schema migration...');
    
    // Read the SQL file
    const sql = fs.readFileSync('./fix_messages_schema.sql', 'utf8');
    
    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 100) + '...');
        
        // Use raw SQL execution through PostgREST
        const { error } = await supabase
          .from('messages')
          .select('*')
          .limit(1);
          
        if (error && error.message.includes('column "conversation_id" does not exist')) {
          console.log('Column conversation_id does not exist - need to apply migration directly');
          console.log('Please run the SQL manually in your Supabase dashboard:');
          console.log('');
          console.log(sql);
          console.log('');
          console.log('Or use the Supabase CLI: supabase db push');
          return;
        }
      }
    }
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    
    if (error.message.includes('conversation_id')) {
      console.log('');
      console.log('The conversation_id column is missing from the messages table.');
      console.log('Please apply the migration manually:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Open the SQL Editor');
      console.log('3. Run the following SQL:');
      console.log('');
      console.log(fs.readFileSync('./fix_messages_schema.sql', 'utf8'));
    }
  }
}

runMigration();
