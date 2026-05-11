const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const s = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    console.log('--- Table Check ---');
    
    const { data: ann, error: err1 } = await s.from('announcements').select('*', { count: 'exact', head: true });
    console.log('announcements:', err1 ? 'ERROR: ' + err1.message : ann ? 'Exists, count: ' + (await s.from('announcements').select('*', { count: 'exact', head: true })).count : 'Empty');
    
    const { data: sann, error: err2 } = await s.from('school_announcements').select('*', { count: 'exact', head: true });
    console.log('school_announcements:', err2 ? 'ERROR: ' + err2.message : sann ? 'Exists, count: ' + (await s.from('school_announcements').select('*', { count: 'exact', head: true })).count : 'Empty');

    const { data: mats, error: err3 } = await s.from('class_materials').select('*', { count: 'exact', head: true });
    console.log('class_materials:', err3 ? 'ERROR: ' + err3.message : mats ? 'Exists, count: ' + (await s.from('class_materials').select('*', { count: 'exact', head: true })).count : 'Empty');

    const { data: evs, error: err4 } = await s.from('school_events').select('*', { count: 'exact', head: true });
    console.log('school_events:', err4 ? 'ERROR: ' + err4.message : evs ? 'Exists, count: ' + (await s.from('school_events').select('*', { count: 'exact', head: true })).count : 'Empty');
}

run();
