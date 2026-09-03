const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRLS() {
    console.log('Checking RLS for teacher_student_assignments...');
    
    // Check if table exists and has RLS
    const { data: tableInfo, error: tableError } = await supabase.rpc('get_table_rls_info', { t_name: 'teacher_student_assignments' });
    
    if (tableError) {
        // Fallback: use raw SQL if RPC doesn't exist
        console.log('RPC failed, checking via direct SQL...');
        const { data: policies, error: polError } = await supabase.from('pg_policies').select('*').eq('tablename', 'teacher_student_assignments');
        console.log('Policies for teacher_student_assignments:', polError ? polError.message : policies);
    } else {
        console.log('RLS Info:', tableInfo);
    }
}

// Since I can't easily run custom SQL RPCs, I'll just check if I can see data as a student vs admin
async function compareVisibility() {
    const studentId = 'euriqt214@gmail.com'; // This is an email, I need a real UUID or just check as service role vs anon
    
    console.log('Fetching as Service Role (Admin)...');
    const { data: adminData, error: adminError } = await supabase.from('teacher_student_assignments').select('*').limit(1);
    console.log('Admin saw:', adminData?.length, 'rows. Error:', adminError?.message);

    // I'll also check the 'subjects' table
    const { data: subData, error: subError } = await supabase.from('subjects').select('*').limit(1);
    console.log('Subjects visible to Admin:', subData?.length, 'rows. Error:', subError?.message);
}

compareVisibility();
