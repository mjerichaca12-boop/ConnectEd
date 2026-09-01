CREATE TABLE IF NOT EXISTS public.grade_sections (
    id uuid default gen_random_uuid() primary key,
    grade_level text not null,
    section_name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(grade_level, section_name)
);

-- RLS Policies
ALTER TABLE public.grade_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access"
    ON public.grade_sections FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow admin full access"
    ON public.grade_sections FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Seed Data
INSERT INTO public.grade_sections (grade_level, section_name) VALUES
    ('7', 'Emerald'),
    ('7', 'Pearl'),
    ('7', 'Topaz'),
    ('8', 'Sapphire'),
    ('8', 'Opal'),
    ('8', 'Jade'),
    ('9', 'Diamond'),
    ('9', 'Garnet'),
    ('9', 'Quartz'),
    ('10', 'Ruby'),
    ('10', 'Onyx'),
    ('10', 'Amethyst'),
    ('10', 'B')
ON CONFLICT (grade_level, section_name) DO NOTHING;
