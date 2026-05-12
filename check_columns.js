import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceKey);

async function checkColumns() {
  const sql = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND table_schema = 'public';
  `;
  
  const { data, error } = await supabase.rpc('exec', { sql });
  
  if (error) {
    // If RPC fails, try selecting one row and checking keys
    console.log('RPC failed, fetching one row instead...');
    const { data: rows, error: selectError } = await supabase.from('messages').select('*').limit(1);
    if (selectError) {
      console.error('Select failed:', selectError);
    } else if (rows && rows.length > 0) {
      console.log('Columns found:', Object.keys(rows[0]));
    } else {
      console.log('Table is empty, trying to insert and rollback...');
      // Try to insert a dummy row to see what works
      const { error: insertError } = await supabase.from('messages').insert({
        sender_id: '11111111-1111-1111-1111-111111111111',
        receiver_id: '11111111-1111-1111-1111-111111111111',
        message_text: 'test'
      }).select();
      if (insertError) {
        console.error('Insert failed:', insertError);
      } else {
        console.log('Insert successful, checking columns...');
        const { data: newRows } = await supabase.from('messages').select('*').limit(1);
        console.log('Columns:', Object.keys(newRows[0]));
      }
    }
  } else {
    console.log('Columns:', data);
  }
}

checkColumns();
