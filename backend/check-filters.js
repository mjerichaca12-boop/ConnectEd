const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPolicies() {
    // There is no easy way to get policies via JS client if not using RPC
    // So I will try to check if selecting with a filter on subject_id fails
    const { error } = await supabase
        .from('assignments_activity')
        .select('id')
        .eq('subject_id', 'test')
        .limit(1);
    
    console.log('Error from subject_id filter:', error?.message);

    const { error: error2 } = await supabase
        .from('assignments_activity')
        .select('id')
        .eq('course_id', 'test')
        .limit(1);
    
    console.log('Error from course_id filter:', error2?.message);
}

checkPolicies();
