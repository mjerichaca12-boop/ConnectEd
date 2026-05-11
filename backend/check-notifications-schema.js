const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkNotificationsSchema() {
    console.log('Checking notifications table columns...');
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching notifications:', error.message);
    } else {
        console.log('Notifications table columns found:', Object.keys(data[0] || {}));
    }
}

checkNotificationsSchema();
