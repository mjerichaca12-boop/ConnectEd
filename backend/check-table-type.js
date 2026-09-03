const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTableType() {
    const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_type')
        .eq('table_name', 'assignments_activity')
        .eq('table_schema', 'public')
        .single();
    
    if (error) {
        console.log('Error checking table type:', error.message);
    } else {
        console.log('Table type:', data.table_type);
    }
}

checkTableType();
