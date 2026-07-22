const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env", "utf8");
const envVars = {};
env.split("\n").forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
        envVars[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
});

console.log("URL:", envVars.VITE_SUPABASE_URL);

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY
);

async function checkSchema() {
  const tables = [
    'lessons', 
    'lesson_materials',
    'class_materials', 
    'class_announcements',
    'attendance', 
    'teacher_student_grades', 
    'assignments',
    'quizzes',
    'assignments_activity',
    'teacher_assessment_grades'
  ];

  for (const table of tables) {
    const { data: cols, error } = await supabase.from(table).select().limit(1);
    if (error) {
        console.log(`Table ${table} error:`, error.message);
    }
    else if (cols && cols.length > 0) {
        console.log(`Table ${table} columns:`, Object.keys(cols[0]).join(', '));
    } else {
        console.log(`Table ${table} is empty or missing`);
    }
  }
}

checkSchema();
