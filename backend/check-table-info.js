const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTableInfo() {
    const { data, error } = await supabase.from('assignments_activity').select('*').limit(1);
    if (error) {
        console.error('Error fetching data:', error);
    } else {
        console.log('Sample row keys:', Object.keys(data[0] || {}));
    }

    // Try to see if it's a view by checking information_schema
    const { data: tableInfo, error: tableError } = await supabase.rpc('check_if_view', { t_name: 'assignments_activity' });
    if (tableError) {
        // If RPC doesn't exist, try a raw query if we can, or just assume it's a table based on previous fetch
        console.log('RPC check_if_view failed, likely not defined.');
    } else {
        console.log('Table Info:', tableInfo);
    }
}

checkTableInfo();
