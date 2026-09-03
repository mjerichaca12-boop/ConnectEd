const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data, error } = await supabase
        .from('announcement_attachments')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Announcement Attachment Keys:', Object.keys(data[0] || {}));
        console.log('Sample Row:', data[0]);
    }
}

checkSchema();
