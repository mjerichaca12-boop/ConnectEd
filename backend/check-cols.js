const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCols() {
    const { data, error } = await supabase.from('conversation_participants').select('*').limit(1);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("conversation_participants columns:", Object.keys(data[0] || {}));
    }
}

checkCols();
