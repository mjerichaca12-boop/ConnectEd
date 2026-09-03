const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugData() {
    console.log('--- DEBUGGING GRADES & ATTENDANCE DATA ---');
    
    // 1. Check teacher_student_assignments table
    const { data: assignments, error: assError } = await supabase
        .from('teacher_student_assignments')
        .select('*')
        .limit(5);
    
    if (assError) {
        console.error('Error fetching assignments:', assError.message);
    } else {
        console.log('Sample rows from teacher_student_assignments:');
        assignments.forEach(row => {
            console.log(`- ID: ${row.id}, Student: ${row.student_id}, Status: ${row.status}`);
            console.log(`  Grades: ${JSON.stringify(row.grades)}`);
            console.log(`  Attendance: ${JSON.stringify(row.attendance)}`);
        });
    }

    // 2. Check enrollments view
    const { data: enrollments, error: enError } = await supabase
        .from('enrollments')
        .select('*')
        .limit(5);

    if (enError) {
        console.error('Error fetching from enrollments view:', enError.message);
    } else {
        console.log('\nSample rows from enrollments view:');
        enrollments.forEach(row => {
            console.log(`- ID: ${row.id}, Status: ${row.status}`);
            console.log(`  Grade (singular): ${JSON.stringify(row.grade)}`);
            console.log(`  Attendance: ${JSON.stringify(row.attendance)}`);
        });
    }
}

debugData();
