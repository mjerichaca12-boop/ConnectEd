-- Mock Data Generator for Gradebook Automation (Using Existing Accounts)

DO $$ 
DECLARE
  v_teacher_id uuid;
  v_student_id uuid;
  v_subject_id uuid;
  v_assignment_id uuid := gen_random_uuid();
  v_quiz_id uuid := gen_random_uuid();
BEGIN
  -- 1. Grab an existing Teacher
  SELECT id INTO v_teacher_id FROM public.profiles WHERE role = 'teacher' LIMIT 1;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'No teacher account found in the database. Please create one first.';
  END IF;

  -- 2. Grab an existing Student
  SELECT id INTO v_student_id FROM public.profiles WHERE role = 'student' LIMIT 1;
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'No student account found in the database. Please create one first.';
  END IF;

  -- 3. Grab or Create a Subject for this teacher
  SELECT id INTO v_subject_id FROM public.subjects WHERE teacher_id = v_teacher_id LIMIT 1;
  
  IF v_subject_id IS NULL THEN
    v_subject_id := gen_random_uuid();
    INSERT INTO public.subjects (id, name, code, section, teacher_id, created_at)
    VALUES (v_subject_id, 'Sample Automation Class', 'AUTO101', 'A', v_teacher_id, now());
  END IF;

  -- 4. Create a Sample Assignment
  INSERT INTO public.assignments_activity (id, course_id, title, description, assessment_type, deadline)
  VALUES (
    v_assignment_id, 
    v_subject_id, 
    'Automation Test Assignment', 
    'Testing the new pending submission workflow.', 
    'assignment', 
    now() + interval '7 days'
  );

  -- 5. Create a Sample Quiz
  INSERT INTO public.assignments_activity (id, course_id, title, description, assessment_type, deadline)
  VALUES (
    v_quiz_id, 
    v_subject_id, 
    'Automation Test Quiz', 
    'Testing the new pending submission workflow.', 
    'quiz', 
    now() + interval '1 day'
  );

  -- 6. Ensure the student has a row in the main Gradebook
  INSERT INTO public.teacher_student_grades (teacher_id, subject_id, student_id, quiz_average, assignment_grade, activity_grade, overall_grade)
  VALUES (v_teacher_id, v_subject_id, v_student_id, 0, 0, 0, 0)
  ON CONFLICT (teacher_id, subject_id, student_id) DO NOTHING;

  -- ==============================================================================
  -- TEST ACTION: Student Submits the Assignment
  -- This is the insert that should FIRE your trigger and auto-create a 'Pending' row!
  -- ==============================================================================
  INSERT INTO public.teacher_assessment_submissions (
    teacher_id, 
    subject_id, 
    student_id, 
    assessment_id, 
    response_text, 
    submitted_at
  ) VALUES (
    v_teacher_id,
    v_subject_id,
    v_student_id,
    v_assignment_id::text, 
    'Hello! This is a test submission from the student.',
    now()
  );

  RAISE NOTICE 'Test Submission created successfully for existing teacher % and student %!', v_teacher_id, v_student_id;
END $$;
