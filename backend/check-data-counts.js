const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
    const { count: rmCount } = await supabase.from('room_members').select('*', { count: 'exact', head: true });
    const { count: cpCount } = await supabase.from('conversation_participants').select('*', { count: 'exact', head: true });
    console.log(`room_members count: ${rmCount}`);
    console.log(`conversation_participants count: ${cpCount}`);
}

checkData();
