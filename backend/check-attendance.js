const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAttendance() {
    const { data, error } = await supabase
        .from('teacher_student_attendance')
        .select('*')
        .limit(5);
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Attendance Records:', data);
    }
}

checkAttendance();
