const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL || "https://pyeckxqaowusxcmeuolk.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedSubjects() {
  const teacherEmail = "erijiao18@gmail.com";
  
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error("Error fetching users", usersError);
    return;
  }
  
  const teacher = usersData.users.find(u => u.email === teacherEmail);
  if (!teacher) {
    console.error(`Teacher ${teacherEmail} not found! Use the app to register or login as teacher first.`);
    return;
  }

  // Ensure profile is hydrated
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: teacher.id,
    first_name: "Teacher",
    last_name: "Admin",
    role: "teacher"
  });
  if (profileError) {
    console.error("Error upserting profile:", profileError);
    return;
  }

  const subjects = [
    { name: "MATH", code: "MTH101", description: "Fundamentals of Mathematics", teacher_id: teacher.id },
    { name: "SCIENCE", code: "SCI101", description: "General Science", teacher_id: teacher.id },
    { name: "ARALIN PANLIPUNAN", code: "AP101", description: "Social Studies", teacher_id: teacher.id },
    { name: "ENGLISH", code: "ENG101", description: "Language and Literature", teacher_id: teacher.id },
    { name: "FILIPINO", code: "FIL101", description: "Wika at Panitikan", teacher_id: teacher.id }
  ];

  console.log("Seeding subjects for teacher ID:", teacher.id);
  
  const { data, error } = await supabase
    .from('subjects')
    .insert(subjects)
    .select();
  
  if (error) {
    console.error("Error inserting subjects:", error.message);
  } else {
    console.log(`Successfully inserted ${data.length} subjects!`);
  }
}

seedSubjects();
