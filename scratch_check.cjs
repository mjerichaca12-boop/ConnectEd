const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing config in .env: VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function run() {
  console.log("Checking class_announcements columns...");
  const { data, error } = await supabase
    .from('class_announcements')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Success! Data row:", data);
    if (data && data.length > 0) {
      console.log("Keys:", Object.keys(data[0]));
    } else {
      console.log("Table is empty. Let's try to query a subject ID first to insert a dummy announcement.");
      const { data: subj } = await supabase.from('subjects').select('id').limit(1);
      if (subj && subj.length > 0) {
        console.log("Found subject ID:", subj[0].id);
        const { data: insData, error: insError } = await supabase
          .from('class_announcements')
          .insert({
            class_id: subj[0].id,
            title: 'Test Temp',
            content: 'Test Temp Content',
            attachments: []
          })
          .select();
        
        console.log("Insert result:", insData);
        if (insError) console.error("Insert error:", insError);
        if (insData && insData.length > 0) {
          console.log("Keys from inserted row:", Object.keys(insData[0]));
          await supabase.from('class_announcements').delete().eq('id', insData[0].id);
        }
      } else {
        console.log("No subjects found.");
      }
    }
  }
}

run();
