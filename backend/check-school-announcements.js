const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchoolAnnouncements() {
    const { data, error } = await supabase.from('school_announcements').select('*').limit(1);
    console.log('School Announcements Columns:', Object.keys(data[0] || {}));
    console.log('Sample Row:', data[0]);
}

checkSchoolAnnouncements();
