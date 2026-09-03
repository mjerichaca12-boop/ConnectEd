const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testRemarks() {
    const { data, error } = await supabase.from('teacher_student_grades').select('remarks').limit(1);
    if (error) {
        console.log('Remarks column does not exist in teacher_student_grades');
    } else {
        console.log('Remarks column EXISTS in teacher_student_grades');
    }
}

testRemarks();
