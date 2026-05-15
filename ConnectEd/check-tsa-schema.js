const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function check() {
    try {
        const { data, error } = await supabase
            .from('teacher_student_assignments')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('Columns:', Object.keys(data[0] || {}));
            console.log('Sample:', data[0]);
        }
    } catch (e) {
        console.error('Catch Error:', e.message);
    }
}

check();
