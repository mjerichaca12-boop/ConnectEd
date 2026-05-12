import { createClient } from '@supabase/supabase-js';

const url = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(url, serviceKey);

async function checkStudents() {
  const { data: students, error } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role')
    .eq('role', 'student')
    .limit(10);
    
  if (error) {
    console.error('Error fetching students:', error);
  } else {
    console.log('Students:', students);
  }
}

checkStudents();
