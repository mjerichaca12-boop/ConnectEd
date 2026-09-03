const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkGradesColumns() {
    const { data, error } = await supabase.from('teacher_student_grades').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Columns:', Object.keys(data[0] || {}));
}

checkGradesColumns();
