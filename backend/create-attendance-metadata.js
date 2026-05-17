const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTable() {
  console.log('Creating attendance_metadata table...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql_query: `
      CREATE TABLE IF NOT EXISTS public.attendance_metadata (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
          attendance_date DATE NOT NULL,
          task TEXT,
          summary TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT attendance_metadata_unique UNIQUE (teacher_id, subject_id, attendance_date)
      );

      ALTER TABLE public.attendance_metadata ENABLE ROW LEVEL SECURITY;
      
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Attendance metadata is viewable by everyone.') THEN
          CREATE POLICY "Attendance metadata is viewable by everyone." ON public.attendance_metadata FOR SELECT USING (true);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role can manage attendance metadata.') THEN
          CREATE POLICY "Service role can manage attendance metadata." ON public.attendance_metadata FOR ALL USING (true);
        END IF;
      END $$;
    `
  });

  if (error) {
    if (error.message.includes('function exec_sql(text) does not exist')) {
        console.error('The exec_sql function does not exist. Please run the SQL manually in Supabase SQL Editor:');
        console.log(`
      CREATE TABLE IF NOT EXISTS public.attendance_metadata (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        `);
    } else {
        console.error('Error creating table:', error);
    }
  } else {
    console.log('attendance_metadata table checked/created successfully.');
  }
}

createTable();
