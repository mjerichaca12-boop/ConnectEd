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
    console.log("Checking RLS Policies for 'messages'...");
    const { data, error } = await supabase.rpc('get_policies', { table_name: 'messages' }).catch(() => ({ data: null, error: 'RPC missing' }));
    
    if (error) {
        // Try another way to see if we can deduce RLS
        console.log("RPC get_policies missing. Checking if table is RLS enabled...");
        const { data: rls, error: rlsErr } = await supabase.rpc('is_rls_enabled', { table_name: 'messages' }).catch(() => ({ data: null, error: 'RPC missing' }));
        console.log("RLS Enabled:", rls);
    } else {
        console.log("Policies:", JSON.stringify(data));
    }
}

run();
