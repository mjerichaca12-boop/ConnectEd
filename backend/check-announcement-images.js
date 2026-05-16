const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAnnouncementImages() {
    const { data, error } = await supabase
        .from('school_announcements')
        .select('id, title, image_url, file_url')
        .not('image_url', 'is', null)
        .limit(1);
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Announcement with Image:', data[0]);
    }
}

checkAnnouncementImages();
