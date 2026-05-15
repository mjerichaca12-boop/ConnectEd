const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const s = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    console.log('--- Data Sample ---');
    
    const { data: ann } = await s.from('school_announcements').select('title, image_url').limit(5);
    console.log('Announcements Sample:', JSON.stringify(ann, null, 2));

    const { data: mat } = await s.from('class_materials').select('title, file_url').limit(5);
    console.log('Materials Sample:', JSON.stringify(mat, null, 2));
}

run();
