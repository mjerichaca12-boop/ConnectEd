const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('get_triggers');
  // Since we can't easily query pg_trigger from anon key without an RPC,
  // we can just try inserting a row into school_calendar_events and catch the exact error.
}

async function testInsert() {
  console.log("Testing insert into school_calendar_events...");
  const { data, error } = await supabase.from('school_calendar_events').insert({
    title: 'Test Event',
    description: 'Test Content',
    event_date: '2026-05-20',
    target_audience: 'School-wide'
  });
  console.log("Insert result:", { data, error });
}

testInsert();
