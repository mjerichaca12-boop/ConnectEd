const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve('C:/Users/lych0/Downloads/ConnectEd/.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) env[key.trim()] = valueParts.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log('Testing INSERT into school_calendar_events...');
  const { data, error } = await supabase.from('school_calendar_events').insert({
    title: 'Test Event ' + Date.now(),
    description: 'This is a test event for triggers',
    event_date: new Date().toISOString().split('T')[0]
  }).select('*');

  if (error) {
    console.error('Failed to insert school calendar event:', error);
  } else {
    console.log('Inserted school calendar event:', data);
    console.log('Checking if notification was generated...');
    // Wait a brief second for trigger to complete (though it is synchronous, let's query)
    const { data: notifications, error: notifError } = await supabase.from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (notifError) {
      console.error('Failed to query notifications:', notifError);
    } else {
      console.log('Recent notifications:', notifications);
    }
  }
}
run();
