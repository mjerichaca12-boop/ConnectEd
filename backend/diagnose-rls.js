const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
    console.log("--- Diagnosing Tables ---");
    const { data: tables, error: tableError } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public');
    if (tableError) {
        console.error("Error fetching tables:", tableError);
    } else {
        console.log("Tables in public schema:", tables.map(t => t.tablename));
    }

    console.log("\n--- Checking RLS Policies for conversation_participants ---");
    const { data: cpPolicies, error: cpError } = await supabase.rpc('get_policies', { table_name: 'conversation_participants' });
    if (cpError) {
        const { data: raw, error: rawError } = await supabase.from('pg_policies').select('*').eq('tablename', 'conversation_participants');
        if (rawError) {
            console.log("Could not fetch policies for conversation_participants");
        } else {
            console.log("Policies for conversation_participants:", raw);
        }
    } else {
        console.log("Policies for conversation_participants:", cpPolicies);
    }

    console.log("\n--- Checking RLS Policies for messages ---");
    const { data: msgPolicies, error: msgError } = await supabase.from('pg_policies').select('*').eq('tablename', 'messages');
    if (msgError) {
        console.log("Could not fetch policies for messages");
    } else {
        console.log("Policies for messages:", msgPolicies);
    }

    console.log("\n--- Checking RLS Policies for room_members ---");
    const { data: rmPolicies, error: rmError } = await supabase.from('pg_policies').select('*').eq('tablename', 'room_members');
    if (rmError) {
        console.log("Could not fetch policies for room_members");
    } else {
        console.log("Policies for room_members:", rmPolicies);
    }
}

diagnose();
