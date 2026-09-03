const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
    const { data, error } = await supabase
        .from('assignments_activity')
        .select('*')
        .limit(3);
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Assignment Data Sample:', data);
    }
}

checkData();
