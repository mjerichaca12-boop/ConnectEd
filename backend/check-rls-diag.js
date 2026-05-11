const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
    console.log("--- Checking RLS Policies for class_materials ---");
    
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'class_materials' });
    
    if (error) {
        // If RPC doesn't exist, we'll try a different way
        const { data: raw, error: rawError } = await supabase.from('pg_policies').select('*').eq('tablename', 'class_materials');
        if (rawError) {
            console.log("Could not fetch policies via SQL, trying direct check...");
        } else {
            console.log("Existing Policies:", raw);
        }
    } else {
        console.log("Policies:", data);
    }
}

checkRLS();
