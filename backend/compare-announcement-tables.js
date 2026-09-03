const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function compareTables() {
    const { count: c1, error: e1 } = await supabase.from('announcements').select('*', { count: 'exact', head: true });
    const { count: c2, error: e2 } = await supabase.from('school_announcements').select('*', { count: 'exact', head: true });
    
    console.log('Announcements count:', e1 ? 'Error: ' + e1.message : c1);
    console.log('School Announcements count:', e2 ? 'Error: ' + e2.message : c2);
}

compareTables();
