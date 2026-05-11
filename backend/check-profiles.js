const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) console.error("Profile Error:", pError);
    console.log("Profiles:", profiles);

    const { data: users, error: uError } = await supabase.auth.admin.listUsers();
    if (uError) console.error("User Error:", uError);
    console.log("Auth Users:", users.users.map(u => ({ id: u.id, email: u.email })));

    const { data: enroll, error: eError } = await supabase.from('enrollments').select('*');
    if (eError) console.error("Enrollment Error:", eError);
    console.log("Enrollments:", enroll);
}

check();
