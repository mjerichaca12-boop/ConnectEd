const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load .env manually if needed
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const tables = ['profiles', 'subjects', 'teacher_student_assignments', 'announcements', 'school_announcements', 'school_announcement', 'announcement', 'announcement_attachment', 'class_materials', 'messages', 'message', 'chat_rooms', 'room_members', 'school_events', 'notifications', 'school_calendar_events'];
    
    console.log("--- SCHEMA QUERY ---");
    for (const table of tables) {
        try {
            // Fallback: try to select 1 row to see columns
            const { data: cols, error: colError } = await supabase.from(table).select('*').limit(1);
            if (colError) {
                console.log(`Table [${table}]: Not found or Error: ${colError.message}`);
            } else {
                const columns = cols.length > 0 ? Object.keys(cols[0]) : "Found but empty (cannot determine columns easily)";
                console.log(`Table [${table}]: Found. Columns: ${Array.isArray(columns) ? columns.join(', ') : columns}`);
            }
        } catch (err) {
            console.log(`Table [${table}]: Critical error: ${err.message}`);
        }
    }
}

run();
