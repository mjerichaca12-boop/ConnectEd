import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchemas() {
  const tables = ['lessons', 'assignments', 'quizzes', 'assignments_activity', 'class_materials', 'lesson_materials'];
  for (const table of tables) {
    console.log(`\nChecking columns for ${table}:`);
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Error: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(Object.keys(data[0]).join(', '));
    } else {
      console.log(`Table ${table} is empty. Trying to get columns from error:`);
      const res = await supabase.rpc('get_columns_for_table', { table_name: table });
      console.log(res);
    }
  }
}

checkSchemas();
