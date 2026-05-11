const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const s = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    console.log('--- Database Audit ---');
    
    // Check Announcements
    const { data: annCols, error: err1 } = await s.from('school_announcements').select('*').limit(1);
    if (err1) console.error('Announcements Error:', err1.message);
    else console.log('Announcements Columns:', annCols.length > 0 ? Object.keys(annCols[0]) : 'No data in table');

    // Check Materials
    const { data: matCols, error: err2 } = await s.from('class_materials').select('*').limit(1);
    if (err2) console.error('Materials Error:', err2.message);
    else console.log('Materials Columns:', matCols.length > 0 ? Object.keys(matCols[0]) : 'No data in table');
}

run();
