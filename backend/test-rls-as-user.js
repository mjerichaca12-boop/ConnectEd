const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Use ANON KEY to simulate a regular user
const supabase = createClient(process.env.SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function checkAsUser() {
    console.log("--- Checking Materials as a REGULAR USER (Testing RLS) ---");
    
    const { data, error, count } = await supabase
        .from('class_materials')
        .select('*', { count: 'exact' });
    
    if (error) {
        console.error("RLS BLOCK DETECTED! Error:", error.message);
    } else {
        console.log(`RLS is OPEN. User can see ${count} materials.`);
        if (data && data.length > 0) {
            console.log("Sample ID visible to user:", data[0].id);
        }
    }
}

checkAsUser();
