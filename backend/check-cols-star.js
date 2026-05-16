const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkColumns() {
    // Select everything but with a query that should fail if subject_id is missing
    const { data, error } = await supabase
        .from('assignments_activity')
        .select('*')
        .limit(1);
    
    if (error) {
        console.log('Error message:', error.message);
    } else {
        console.log('Columns found:', Object.keys(data[0] || {}));
    }
}

checkColumns();
