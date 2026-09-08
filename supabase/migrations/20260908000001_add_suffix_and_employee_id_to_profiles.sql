-- Add suffix and employee_id columns to public.profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS suffix TEXT,
ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- Create unique index for employee_id on teacher profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_teacher_employee_id_unique
ON public.profiles (employee_id)
WHERE role = 'teacher' AND employee_id IS NOT NULL AND employee_id <> '';
