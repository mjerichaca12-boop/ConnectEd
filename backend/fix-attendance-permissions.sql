-- ============================================================
-- ConnectEd: Attendance Permissions Fix
-- Ensures students can view their own attendance records
-- ============================================================

-- 1. Enable RLS on the attendance table
ALTER TABLE public.teacher_student_attendance ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Students can view their own attendance" ON public.teacher_student_attendance;
DROP POLICY IF EXISTS "Teachers can manage attendance" ON public.teacher_student_attendance;

-- 3. Create the student view policy
CREATE POLICY "Students can view their own attendance" 
ON public.teacher_student_attendance 
FOR SELECT 
USING (auth.uid() = student_id);

-- 4. Create the teacher manage policy (for the web portal to keep working)
CREATE POLICY "Teachers can manage attendance" 
ON public.teacher_student_attendance 
FOR ALL 
USING (auth.uid() = teacher_id);

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';
