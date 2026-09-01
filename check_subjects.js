import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceKey);

async function checkColumns() {
  const { data: rows, error } = await supabase.from('subjects').select('*').limit(1);
  if (error) {
    console.error('Error fetching subjects:', error);
  } else if (rows && rows.length > 0) {
    console.log('Columns found:', Object.keys(rows[0]));
    console.log('Sample row:', rows[0]);
  } else {
    console.log('Table is empty, attempting to describe columns by inserting a dummy or fetching another way.');
    // Let's try select check
    const { data, error: selectErr } = await supabase.from('subjects').select('id').limit(1);
    if (selectErr) {
       console.error('Select ID failed:', selectErr);
    } else {
       console.log('Table exists and is empty.');
       // Let's query information_schema if RPC is available or try some columns
       const testCols = ['id', 'code', 'name', 'description', 'credits', 'teacher_id', 'section', 'schedule', 'capacity', 'enrolled', 'grade_level'];
       for (const col of testCols) {
         const { error: colErr } = await supabase.from('subjects').select(col).limit(1);
         console.log(`Column ${col}:`, colErr ? 'Does NOT exist' : 'Exists');
       }
    }
  }
}

checkColumns();
