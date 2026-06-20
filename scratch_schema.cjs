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
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log("Fetching OpenAPI spec for announcements...");
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });

  if (response.ok) {
    const data = await response.json();
    const tableInfo = data.definitions.announcements;
    if (tableInfo) {
      console.log("Columns definition for announcements:");
      console.log(JSON.stringify(tableInfo.properties, null, 2));
    } else {
      console.log("announcements definition not found in definitions.");
    }
  } else {
    console.error("Failed to fetch spec:", response.status);
  }
}

run();
