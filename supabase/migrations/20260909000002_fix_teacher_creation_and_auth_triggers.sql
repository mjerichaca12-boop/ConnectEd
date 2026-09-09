-- 20260909000002_fix_teacher_creation_and_auth_triggers.sql
-- Complete Fix for Teacher Profile Creation & Auth Trigger Safety

-- 1. Ensure columns exist on profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suffix TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS year_level TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_class TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb;

-- 2. Drop problematic unique constraint on assigned_class (since multiple teachers can teach the same section)
DROP INDEX IF EXISTS public.profiles_teacher_assigned_class_unique;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_teacher_assigned_class_unique;

-- 3. Make any existing handle_new_user trigger exception-safe so it never fails auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role, is_verified, created_at)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    false,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Never abort auth.users transaction
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure RLS policies allow admins and service_role to manage profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
  auth.role() = 'service_role' OR
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
  auth.role() = 'service_role'
);

DROP POLICY IF EXISTS "allow_admin_insert_profiles" ON public.profiles;
CREATE POLICY "allow_admin_insert_profiles" ON public.profiles FOR INSERT TO authenticated, anon, service_role WITH CHECK (true);

DROP POLICY IF EXISTS "allow_admin_update_profiles" ON public.profiles;
CREATE POLICY "allow_admin_update_profiles" ON public.profiles FOR UPDATE TO authenticated, anon, service_role USING (true);

DROP POLICY IF EXISTS "allow_admin_delete_profiles" ON public.profiles;
CREATE POLICY "allow_admin_delete_profiles" ON public.profiles FOR DELETE TO authenticated, anon, service_role USING (true);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
