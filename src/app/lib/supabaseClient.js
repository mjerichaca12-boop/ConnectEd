import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log("🔍 Supabase Config Debug:");
console.log("  VITE_SUPABASE_URL:", supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "MISSING");
console.log("  VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : "MISSING");
console.log("  VITE_SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceRoleKey ? "SET" : "MISSING");

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ Supabase configuration missing. " +
    "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file. " +
    "Copy .env.example to .env and fill in your Supabase credentials."
  );
}

if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
  console.error(
    "❌ Invalid VITE_SUPABASE_URL format. URL must start with https://. " +
    "Current value:", supabaseUrl
  );
}

export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://'))
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    })
  : null;

export const supabaseAdmin = (supabaseUrl && supabaseServiceRoleKey && supabaseUrl.startsWith('https://'))
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;