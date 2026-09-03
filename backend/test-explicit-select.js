const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPolicies() {
    // We can use a raw SQL query via a temporary RPC if needed, 
    // but first let's just try to fetch the table structure again with more detail if possible.
    // Actually, let's just try to RUN a query that specifically avoids subject_id.
    
    const { data, error } = await supabase
        .from('assignments_activity')
        .select('id, title, course_id')
        .limit(1);
        
    if (error) {
        console.error('Error with explicit select:', error);
    } else {
        console.log('Success with explicit select:', data);
    }
}

checkPolicies();
