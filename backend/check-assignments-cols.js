const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'assignments_activity' });
    if (error) {
        // Fallback if RPC doesn't exist
        const { data: cols, error: colError } = await supabase
            .from('assignments_activity')
            .select('*')
            .limit(1);
        
        if (colError) {
            console.error('Error fetching columns:', colError);
            return;
        }
        console.log('Columns found:', Object.keys(cols[0] || {}));
    } else {
        console.log('Columns from RPC:', data);
    }
}

checkColumns();
