const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
    console.log('Fetching latest 5 messages...');
    const { data, error } = await supabase
        .from('messages')
        .select('content, message_text, sender_id, receiver_id')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching messages:', error.message);
    } else {
        console.log('Latest messages data:', data);
    }
}

checkData();
