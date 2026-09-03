const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const email = "euriqt214@gmail.com";
    console.log(`Checking if user ${email} exists to purge for clean testing...`);

    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
        console.error("Error listing users:", error.message);
        process.exit(1);
    }

    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (user) {
        console.log(`Found user: ${user.id}. Deleting profiles and auth to allow fresh registration...`);
        
        // Delete profile
        const { error: profileErr } = await supabase
            .from("profiles")
            .delete()
            .eq("id", user.id);
        if (profileErr) console.warn("Warning deleting profile:", profileErr.message);

        // Delete auth user
        const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
        if (authErr) {
            console.error("Error deleting auth user:", authErr.message);
        } else {
            console.log(`✅ Success! Completely purged ${email} from database.`);
        }
    } else {
        console.log(`No user found for ${email}. It is already clear and ready for a fresh sign up!`);
    }
    process.exit(0);
}
run();
