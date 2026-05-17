// Test script to check if service role can insert into teacher_access_requests
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://pyeckxqaowusxcmeuolk.supabase.co";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

console.log("Using service role key:", serviceRoleKey ? "YES (length: " + serviceRoleKey.length + ")" : "NO");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

// Test simple insert
const { data, error } = await supabase
  .from("teacher_access_requests")
  .insert({
    email: "test_rls_check_" + Date.now() + "@test.local",
    first_name: "Test",
    last_name: "RLS",
    status: "pending"
  })
  .select();

if (error) {
  console.error("INSERT failed with error:", error.message);
  console.error("Details:", error.details);
  console.error("Code:", error.code);
  console.error("This suggests RLS policy is blocking inserts");
  Deno.exit(1);
} else {
  console.log("INSERT succeeded! RLS policy is correctly configured");
  console.log("Inserted record:", data);
  Deno.exit(0);
}
