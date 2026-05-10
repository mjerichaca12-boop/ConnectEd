-- Add INSERT policy for class_materials table to allow teachers to upload materials
CREATE POLICY "Teachers can insert class materials" ON public.class_materials
FOR INSERT WITH CHECK (
  current_user_role() = 'teacher' AND 
  auth.uid() = teacher_id
);

-- Add UPDATE policy for class_materials table to allow teachers to update their own materials  
CREATE POLICY "Teachers can update their own class materials" ON public.class_materials
FOR UPDATE USING (
  current_user_role() = 'teacher' AND 
  auth.uid() = teacher_id
);

-- Add DELETE policy for class_materials table to allow teachers to delete their own materials
CREATE POLICY "Teachers can delete their own class materials" ON public.class_materials
FOR DELETE USING (
  current_user_role() = 'teacher' AND 
  auth.uid() = teacher_id
);
