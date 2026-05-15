const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
    console.log("--- Checking RLS Policies ---");
    
    // We try to list all policies by querying a table that might exist or using a common trick
    // Since we can't query pg_policies directly, we'll try to check the tables we suspect
    const tables = ['messages', 'room_members', 'conversation_participants', 'chat_rooms'];
    
    for (const table of tables) {
        console.log(`\nChecking table: ${table}`);
        const { data, error } = await supabase.rpc('get_policies', { table_name: table });
        
        if (error) {
            console.log(`Could not fetch policies for ${table} via RPC.`);
            // Try to deduce by doing a simple select and seeing the error (if any)
            try {
                const { error: selectError } = await supabase.from(table).select('*').limit(1);
                if (selectError) {
                    console.log(`Select error for ${table}:`, selectError.message);
                } else {
                    console.log(`Select from ${table} succeeded.`);
                }
            } catch (e) {
                console.log(`Select from ${table} threw:`, e.message);
            }
        } else {
            console.log(`Policies for ${table}:`, JSON.stringify(data, null, 2));
        }
    }
}

checkRLS();
