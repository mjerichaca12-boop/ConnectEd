-- ============================================================
-- ConnectEd: Full Schema Migration (idempotent version)
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    middle_name TEXT,
    role TEXT CHECK (role IN ('student', 'teacher', 'admin')),
    year_level TEXT,
    section TEXT,
    course TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any) then recreate – makes the script re‑runnable
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. SUBJECTS TABLE
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Subjects are viewable by everyone." ON public.subjects;
CREATE POLICY "Subjects are viewable by everyone." ON public.subjects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Teachers can insert subjects." ON public.subjects;
CREATE POLICY "Teachers can insert subjects." ON public.subjects FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Teachers can update their own subjects." ON public.subjects;
CREATE POLICY "Teachers can update their own subjects." ON public.subjects FOR UPDATE USING (auth.uid() = teacher_id);

-- 3. ENROLLMENTS VIEW (maps to web table teacher_student_assignments)
DROP TABLE IF EXISTS public.enrollments CASCADE;

CREATE OR REPLACE VIEW public.enrollments AS
SELECT
    id,
    subject_id,
    student_id,
    CASE
        WHEN lower(status) = 'active' THEN 'accepted'
        ELSE lower(status)
    END AS status,
    created_at,
    NULL::text AS grade,
    NULL::text AS attendance
FROM public.teacher_student_assignments;

-- Views don't directly have RLS policies. They use the underlying table's policies.
-- We just need to give the API roles permission to select from this view.
GRANT SELECT ON public.enrollments TO authenticated, anon, service_role;

-- 4. ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Announcements are viewable by everyone." ON public.announcements;
CREATE POLICY "Announcements are viewable by everyone." ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert announcements." ON public.announcements;
CREATE POLICY "Authenticated users can insert announcements." ON public.announcements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Authors can update their announcements." ON public.announcements;
CREATE POLICY "Authors can update their announcements." ON public.announcements FOR UPDATE USING (auth.uid() = author_id);
DROP POLICY IF EXISTS "Authors can delete their announcements." ON public.announcements;
CREATE POLICY "Authors can delete their announcements." ON public.announcements FOR DELETE USING (auth.uid() = author_id);

-- 5. SCHOOL EVENTS TABLE (for calendar)
CREATE TABLE IF NOT EXISTS public.school_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT DEFAULT 'Event',
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School events are viewable by everyone." ON public.school_events;
CREATE POLICY "School events are viewable by everyone." ON public.school_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert school events." ON public.school_events;
CREATE POLICY "Authenticated users can insert school events." ON public.school_events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Creators can update school events." ON public.school_events;
CREATE POLICY "Creators can update school events." ON public.school_events FOR UPDATE USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "Creators can delete school events." ON public.school_events;
CREATE POLICY "Creators can delete school events." ON public.school_events FOR DELETE USING (auth.uid() = created_by);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    type TEXT DEFAULT 'alert',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notifications." ON public.notifications;
CREATE POLICY "Users can view their own notifications." ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Any authenticated user can insert notifications." ON public.notifications;
CREATE POLICY "Any authenticated user can insert notifications." ON public.notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can update their own notifications." ON public.notifications;
CREATE POLICY "Users can update their own notifications." ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- 7. OTPs TABLE (for OTP login flow)
CREATE TABLE IF NOT EXISTS public.otps (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage otps." ON public.otps;
CREATE POLICY "Service role can manage otps." ON public.otps FOR ALL USING (true);

-- 8. ATTENDANCE METADATA TABLE
CREATE TABLE IF NOT EXISTS public.attendance_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    task TEXT,
    summary TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT attendance_metadata_unique UNIQUE (teacher_id, subject_id, attendance_date)
);

ALTER TABLE public.attendance_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendance metadata is viewable by everyone." ON public.attendance_metadata FOR SELECT USING (true);
CREATE POLICY "Service role can manage attendance metadata." ON public.attendance_metadata FOR ALL USING (true);

-- ============================================================
-- Refresh PostgREST schema cache
-- (Run this after creating the tables to fix PGRST205 errors)
-- ============================================================
NOTIFY pgrst, 'reload schema';
