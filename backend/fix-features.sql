-- ============================================================
-- ConnectEd: Comprehensive Feature Fix (Announcements, Materials, Calendar)
-- ============================================================

-- 1. UNIFIED ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.school_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'general',
    image_url TEXT,
    file_url TEXT,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure RLS is enabled
ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Announcements are viewable by everyone." ON public.school_announcements;
CREATE POLICY "Announcements are viewable by everyone." ON public.school_announcements FOR SELECT USING (true);

-- 2. CLASS MATERIALS TABLE
CREATE TABLE IF NOT EXISTS public.class_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    file_type TEXT,
    type TEXT DEFAULT 'pdf', -- pdf, doc, other
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.class_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Materials are viewable by everyone." ON public.class_materials;
CREATE POLICY "Materials are viewable by everyone." ON public.class_materials FOR SELECT USING (true);

-- 3. SCHOOL EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.school_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT DEFAULT 'Event', -- Holiday, Academic, Meeting, Event
    color TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events are viewable by everyone." ON public.school_events;
CREATE POLICY "Events are viewable by everyone." ON public.school_events FOR SELECT USING (true);

-- 4. SEED DATA (Only if empty)

-- Seed Announcements
INSERT INTO public.school_announcements (title, content, type)
SELECT 'Welcome to ConnectEd', 'Welcome back to another exciting academic year!', 'general'
WHERE NOT EXISTS (SELECT 1 FROM public.school_announcements);

-- Seed Events
INSERT INTO public.school_events (title, date, type, color)
SELECT 'First Day of Classes', CURRENT_DATE + INTERVAL '1 day', 'Academic', '#10B981'
WHERE NOT EXISTS (SELECT 1 FROM public.school_events);

INSERT INTO public.school_events (title, date, type, color)
SELECT 'Foundation Day', CURRENT_DATE + INTERVAL '10 days', 'Event', '#F59E0B'
WHERE NOT EXISTS (SELECT 1 FROM public.school_events);

-- 5. STORAGE BUCKET FOR MATERIALS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('class-materials', 'class-materials', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for class-materials
DROP POLICY IF EXISTS "Public Access Materials" ON storage.objects;
CREATE POLICY "Public Access Materials" ON storage.objects FOR SELECT USING (bucket_id = 'class-materials');

DROP POLICY IF EXISTS "Authenticated Upload Materials" ON storage.objects;
CREATE POLICY "Authenticated Upload Materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'class-materials' AND auth.role() = 'authenticated');

-- 6. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
