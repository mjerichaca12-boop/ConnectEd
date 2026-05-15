-- Fix class_materials RLS policies to properly handle user authentication

-- Drop existing policies
DROP POLICY IF EXISTS class_materials_select_authenticated ON public.class_materials;
DROP POLICY IF EXISTS class_materials_insert_authenticated ON public.class_materials;
DROP POLICY IF EXISTS class_materials_update_authenticated ON public.class_materials;
DROP POLICY IF EXISTS class_materials_delete_authenticated ON public.class_materials;

-- Create proper RLS policies for class_materials
-- Policy: Users can select class materials (read access for all authenticated users)
CREATE POLICY class_materials_select_authenticated
  ON public.class_materials
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only teachers can insert class materials
CREATE POLICY class_materials_insert_teachers
  ON public.class_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'teacher'
    ) AND
    (auth.uid() = teacher_id OR auth.uid() = created_by)
  );

-- Policy: Only teachers who created the material can update it
CREATE POLICY class_materials_update_own
  ON public.class_materials
  FOR UPDATE
  TO authenticated
  USING (
    (teacher_id = auth.uid() OR created_by = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'teacher'
    )
  )
  WITH CHECK (
    (teacher_id = auth.uid() OR created_by = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'teacher'
    )
  );

-- Policy: Only teachers who created the material can delete it
CREATE POLICY class_materials_delete_own
  ON public.class_materials
  FOR DELETE
  TO authenticated
  USING (
    (teacher_id = auth.uid() OR created_by = auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role = 'teacher'
    )
  );
