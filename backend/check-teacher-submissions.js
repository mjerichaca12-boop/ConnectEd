const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTeacherSubmissions() {
    const { data, error } = await supabase
        .from('teacher_assessment_submissions')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Teacher Assessment Submissions Keys:', Object.keys(data[0] || {}));
        console.log('Sample Row:', data[0]);
    }
}

checkTeacherSubmissions();
