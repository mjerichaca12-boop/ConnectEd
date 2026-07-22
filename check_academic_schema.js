import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  const tables = [
    'lessons', 
    'class_materials', 
    'attendance', 
    'teacher_student_grades', 
    'assignments',
    'quizzes',
    'assignments_activity',
    'teacher_assessment_grades'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: table }).catch(() => ({ error: 'rpc missing' }));
    
    // Fallback if no RPC
    if (error || !data) {
        const { data: cols } = await supabase.from(table).select().limit(1);
        if (cols && cols.length > 0) {
            console.log(`Table ${table} columns:`, Object.keys(cols[0]).join(', '));
        } else {
            console.log(`Table ${table} is empty or missing`);
        }
    } else {
        console.log(`Table ${table} columns:`, data);
    }
  }
}

checkSchema();
