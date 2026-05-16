-- ============================================================
-- ConnectEd: Term-Based Grades Rescue Script
-- Maps teacher_student_grades to the new Student Portal categories
-- ============================================================

UPDATE public.teacher_student_assignments tsa
SET grades = jsonb_build_object(
    't1', old.term1_grade,
    't2', old.term2_grade,
    't3', old.term3_grade,
    'quiz', old.quiz_average,
    'activity', old.activity_grade,
    'assignment', old.assignment_grade,
    'exam', old.exam_grade,
    'overall', old.overall_grade,
    'remarks', 'Synced from Teacher Portal'
)
FROM public.teacher_student_grades old
WHERE tsa.student_id = old.student_id 
AND tsa.subject_id = old.subject_id;

-- Ensure the view reflects these changes
NOTIFY pgrst, 'reload schema';
