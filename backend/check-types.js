const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTypes() {
    // Query pg_attribute to get types
    const { data, error } = await supabase.rpc('get_table_info', { table_name: 'conversation_participants' }).catch(() => ({ data: null, error: 'RPC missing' }));
    
    if (error || !data) {
        // Try another way: just insert a dummy row or something? No.
        // Let's try to query a system view if available, otherwise we guess.
        console.log("Could not get types via RPC. Guessing based on error message.");
    } else {
        console.log("Table info:", data);
    }
}

checkTypes();
