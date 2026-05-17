#!/usr/bin/env node
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://pyeckxqaowusxcmeuolk.supabase.co";
// Using the service role key to apply migrations
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error("Error: SUPABASE_SERVICE_KEY or VITE_SUPABASE_SERVICE_KEY environment variable not set");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = `
-- Add INSERT policy for teacher_access_requests to allow unauthenticated submissions
create policy if not exists teacher_access_requests_insert_public
on public.teacher_access_requests
for insert
to anon, authenticated
with check (true);
`;

async function applyMigration() {
  try {
    console.log("Applying INSERT policy for teacher_access_requests...");
    const { data, error } = await supabase.rpc("execute_sql", {
      sql: sql
    });

    if (error) {
      console.error("Error applying migration:", error);
      process.exit(1);
    }

    console.log("Migration applied successfully!");
  } catch (err) {
    console.error("Exception:", err);
    process.exit(1);
  }
}

applyMigration();
