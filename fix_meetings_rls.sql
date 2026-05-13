-- Disable RLS temporarily to allow access while we fix policies properly
ALTER TABLE public.online_class_meetings DISABLE ROW LEVEL SECURITY;

-- If we wanted to keep RLS but allow anyone to insert (less secure but works without auth)
-- ALTER TABLE public.online_class_meetings ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow anon insert" ON public.online_class_meetings;
-- CREATE POLICY "Allow anon insert" ON public.online_class_meetings FOR INSERT WITH CHECK (true);
-- DROP POLICY IF EXISTS "Allow anon select" ON public.online_class_meetings;
-- CREATE POLICY "Allow anon select" ON public.online_class_meetings FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Allow anon update" ON public.online_class_meetings;
-- CREATE POLICY "Allow anon update" ON public.online_class_meetings FOR UPDATE USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS "Allow anon delete" ON public.online_class_meetings;
-- CREATE POLICY "Allow anon delete" ON public.online_class_meetings FOR DELETE USING (true);
