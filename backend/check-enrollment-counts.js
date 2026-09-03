const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkEnrollmentTables() {
    console.log('Checking enrollment tables...');
    
    const { count: enrollCount, error: enrollError } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true });
        
    const { count: assignCount, error: assignError } = await supabase
        .from('teacher_student_assignments')
        .select('*', { count: 'exact', head: true });
        
    console.log('Enrollments table count:', enrollError ? 'Error: ' + enrollError.message : enrollCount);
    console.log('teacher_student_assignments count:', assignError ? 'Error: ' + assignError.message : assignCount);
}

checkEnrollmentTables();
