const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySql(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Applying SQL from ${filePath}...`);
    
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error applying SQL via RPC:', error.message);
      
      // Try direct fetch to rest/v1/rpc/exec_sql (common pattern in this project)
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ sql })
      });

      if (response.ok) {
        console.log('✅ SQL applied successfully via fetch!');
      } else {
        const errData = await response.json().catch(() => ({}));
        console.error('❌ Failed to apply SQL via fetch:', response.status, errData);
        console.log('\n--- SQL START ---');
        console.log(sql);
        console.log('--- SQL END ---\n');
      }
    } else {
      console.log('✅ SQL applied successfully via RPC!');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node run_sql.cjs <file.sql>');
  process.exit(1);
}

applySql(file);
