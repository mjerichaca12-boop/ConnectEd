const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pyeckxqaowusxcmeuolk.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZWNreHFhb3d1c3hjbWV1b2xrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY1MzQ0MiwiZXhwIjoyMDg5MjI5NDQyfQ.cDPqfbnsriANJ1pGSnkdmsw5BWUuHxQP5_Fxv2Sdrbg';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    console.log('Applying migration to add audience_type column to school_announcements...');
    
    const sql = `
      -- Add audience_type to school_announcements table
      alter table if exists public.school_announcements
        add column if not exists audience_type text;

      -- Update existing rows based on target_audience
      update public.school_announcements
      set audience_type = case
        when lower(trim(target_audience)) = 'students' then 'student'
        when lower(trim(target_audience)) = 'teacher' then 'teacher'
        else 'school'
      end
      where audience_type is null;

      -- Set default and constraints
      alter table if exists public.school_announcements
        alter column audience_type set default 'school';

      alter table if exists public.school_announcements
        alter column audience_type set not null;

      alter table if exists public.school_announcements
        drop constraint if exists school_announcements_audience_type_check;

      alter table if exists public.school_announcements
        add constraint school_announcements_audience_type_check
        check (audience_type in ('student', 'teacher', 'school'));

      create index if not exists school_announcements_audience_type_idx
        on public.school_announcements (audience_type);
    `;
    
    // Try the RPC function to execute raw SQL
    const { data, error } = await supabase.rpc('exec', { sql });
    
    if (error) {
      console.log('RPC exec failed, trying direct HTTP method...');
      
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ sql })
      });
      
      if (response.ok) {
        console.log('✅ Migration applied successfully!');
      } else {
        console.log('❌ Could not apply migration automatically.');
        console.log('SQL to run manually:');
        console.log(sql);
      }
    } else {
      console.log('✅ Migration applied successfully!');
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
  }
}

applyMigration();
