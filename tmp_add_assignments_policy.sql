CREATE POLICY "Teachers can insert assignments by subject ownership"
ON public.assignments_activity
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.subjects
    WHERE subjects.id = assignments_activity.course_id
      AND subjects.teacher_id = auth.uid()
  )
);
