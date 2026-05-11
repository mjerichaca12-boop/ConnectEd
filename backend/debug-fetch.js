const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("Testing Message Fetch...");
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
    if (error) console.error("Fetch Error:", error);
    else {
        console.log("Fetch Success:", data.length, "messages found");
        data.forEach(m => {
            console.log(`Msg: from=${m.sender_id} to=${m.receiver_id} content=${m.content || m.message_text} created_at=${m.created_at} timestamp=${m.timestamp}`);
        });
    }

    console.log("\nTesting Class Materials Fetch...");
    const { data: mat, error: matErr } = await supabase.from('class_materials').select('*').limit(5);
    if (matErr) console.error("Materials Fetch Error:", matErr);
    else console.log("Materials Fetch Success:", mat.length, "materials found");
}

run();
