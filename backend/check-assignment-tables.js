const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
    const tables = ['assignments_activity', 'class_assignments', 'assignments', 'teacher_assignments', 'class_activities'];
    const results = [];
    
    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
        
        results.push({ table, exists: !error, count: count || 0, error: error?.message });
    }
    
    console.log('Assignment Tables Status:', results);
}

checkTables();
