const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.conversation_reads (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
        counterpart_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
        last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id, conversation_id),
        UNIQUE(user_id, counterpart_id),
        CONSTRAINT check_conversation_target CHECK (
            (conversation_id IS NOT NULL AND counterpart_id IS NULL) OR
            (conversation_id IS NULL AND counterpart_id IS NOT NULL)
        )
    );

    ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_reads' AND policyname = 'Enable all for users') THEN
            CREATE POLICY "Enable all for users" ON public.conversation_reads FOR ALL USING (true) WITH CHECK (true);
        END IF;
    END
    $$;
  `;

  // Since we don't have a direct SQL execution API configured with a direct postgres connection string, 
  // I will execute it via the postgres_changes if available, but the easiest way is to use a REST endpoint if they have one,
  // or I can just create it using the raw pg driver. But I don't have the connection string.
  // Wait, I previously used postgres connections using `psql` or `pg` module if the user has it, or we created tables using supabase sql endpoint?
  console.log("SQL to execute:\\n", sql);
}

migrate();
