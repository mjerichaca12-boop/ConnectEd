const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://pyeckxqaowusxcmeuolk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg'
);

async function testInsert() {
  const payload = {
    sender_id: '11111111-1111-1111-1111-111111111111',
    receiver_id: 'e1240583-9fbf-42e7-be47-6cf7d6224e90',
    conversation_id: null,
    message_text: 'Sent 1 attachment(s)',
    content: 'Sent 1 attachment(s)',
    timestamp: new Date().toISOString(),
    status: 'sent'
  };

  console.log("Inserting payload:", payload);
  const { data, error } = await supabase
    .from('messages')
    .insert([payload])
    .select("id, sender_id, receiver_id, message_text, content, timestamp, created_at, file_url, file_name, file_type, file_size, is_read, status");

  if (error) {
    console.error("Insert error:", JSON.stringify(error, null, 2));
  } else {
    console.log("Insert success:", data);
  }
}

testInsert();
