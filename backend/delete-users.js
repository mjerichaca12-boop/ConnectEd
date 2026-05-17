const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL || "https://pyeckxqaowusxcmeuolk.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const emailsToDelete = [
  "reincosare07@gmail.com", 
  "reincosare@gmail.com",
  "danielcosare07@gmaul.com", 
  "danielcosare07@gmail.com",
  "danielcosare27@gmail.com"
];

async function deleteAccounts() {
  console.log("🔍 Starting deletion process...");

  for (const email of emailsToDelete) {
    console.log(`\n📧 Processing: ${email}`);

    // 1. Find profile
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email);

    if (profileError) {
      console.error(`❌ Error fetching profile for ${email}:`, profileError.message);
      continue;
    }

    if (!profiles || profiles.length === 0) {
      console.log(`⚠️ No profile found for ${email} in 'profiles' table.`);
      
      // Try to find in Auth even if profile is missing
      console.log(`🔍 Checking Supabase Auth for ${email}...`);
      const { data: { users }, error: authSearchError } = await supabase.auth.admin.listUsers();
      
      if (authSearchError) {
        console.error(`❌ Error listing auth users:`, authSearchError.message);
      } else {
        const authUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (authUser) {
          console.log(`✅ Found Auth User: ${authUser.id}. Deleting...`);
          const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(authUser.id);
          if (deleteAuthError) console.error(`❌ Failed to delete Auth User:`, deleteAuthError.message);
          else console.log(`✨ Successfully deleted Auth User for ${email}`);
        } else {
          console.log(`❌ No Auth User found for ${email}`);
        }
      }
      continue;
    }

    // 2. Delete Profile and Auth User
    for (const profile of profiles) {
      console.log(`✅ Found Profile ID: ${profile.id}. Deleting...`);

      // Delete Auth User (this usually triggers profile deletion if there's a cascade, 
      // but we'll do both to be sure)
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(profile.id);
      if (deleteAuthError) {
        console.error(`❌ Error deleting Auth User ${profile.id}:`, deleteAuthError.message);
      } else {
        console.log(`✨ Successfully deleted Auth User for ${email}`);
      }

      // Delete Profile row explicitly
      const { error: deleteProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profile.id);

      if (deleteProfileError) {
        console.error(`❌ Error deleting profile record ${profile.id}:`, deleteProfileError.message);
      } else {
        console.log(`✨ Successfully deleted Profile record for ${email}`);
      }
    }
  }

  console.log("\n🏁 Deletion process finished.");
}

deleteAccounts();
