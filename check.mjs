import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pyeckxqaowusxcmeuolk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg'
);

async function check() {
  // Check teacher_assessment_grades columns and data
  const { data: grades, error: gradesError } = await supabase
    .from('teacher_assessment_grades')
    .select('assessment_id, student_id, grade_value, feedback, status, updated_at')
    .limit(5);
  
  console.log('teacher_assessment_grades error:', gradesError);
  console.log('teacher_assessment_grades sample rows:', JSON.stringify(grades, null, 2));

  // Check submission_feedback
  const { data: feedback, error: feedbackError } = await supabase
    .from('submission_feedback')
    .select('submission_id, teacher_id, comments, feedback_text, updated_at')
    .limit(5);

  console.log('submission_feedback error:', feedbackError);
  console.log('submission_feedback sample rows:', JSON.stringify(feedback, null, 2));

  // Check teacher_assessment_submissions status
  const { data: subs, error: subsError } = await supabase
    .from('teacher_assessment_submissions')
    .select('id, assessment_id, student_id, status, updated_at')
    .eq('status', 'Returned')
    .limit(5);

  console.log('returned submissions error:', subsError);
  console.log('returned submissions:', JSON.stringify(subs, null, 2));
}

check();
