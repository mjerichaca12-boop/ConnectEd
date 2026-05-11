const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixNotificationsTable() {
    console.log('Attempting to fix notifications table...');
    
    // We can't run ALTER TABLE directly via JS client.
    // But we can try to use an RPC if it exists, or just tell the user.
    
    console.log('IMPORTANT: You MUST run the updated SQL in your Supabase SQL Editor.');
    console.log('The error "column body does not exist" is because your notifications table is outdated.');
    
    console.log('Please copy and run this specific command in Supabase:');
    console.log('ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body TEXT;');
}

fixNotificationsTable();
