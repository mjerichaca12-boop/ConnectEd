const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixProfiles() {
    console.log("Fetching auth.users...");
    const { data: usersData, error: uError } = await supabase.auth.admin.listUsers();
    if (uError) {
        console.error("Failed to fetch users:", uError);
        return;
    }

    const users = usersData.users;
    console.log(`Found ${users.length} users.`);

    for (const u of users) {
        // Only insert if missing
        const { data: existing } = await supabase.from('profiles').select('id').eq('id', u.id).single();
        if (!existing) {
            console.log(`Missing profile for ${u.email} (${u.id}). Creating...`);
            let role = 'student';
            if (u.email === 'erijiao18@gmail.com') role = 'teacher';

            // Extract name from email roughly if possible
            const nameParts = u.email.split('@')[0].split('.');
            let firstName = nameParts[0];
            let lastName = nameParts.length > 1 ? nameParts[1] : 'Student';

            const { error: insErr } = await supabase.from('profiles').insert({
                id: u.id,
                first_name: firstName.charAt(0).toUpperCase() + firstName.slice(1),
                last_name: lastName.charAt(0).toUpperCase() + lastName.slice(1),
                role: role,
                is_verified: true
            });

            if (insErr) {
                console.error(`Failed to create profile for ${u.email}:`, insErr);
            } else {
                console.log(`✅ Profile created for ${u.email}`);
            }
        } else {
            console.log(`Profile already exists for ${u.email}`);
        }
    }
    console.log("Done checking profiles!");
}

fixProfiles();
