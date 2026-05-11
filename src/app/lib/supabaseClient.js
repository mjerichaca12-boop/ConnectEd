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

// Use globalThis to ensure truly global singleton across the entire app
if (!globalThis.supabaseClientInstance) {
  if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://')) {
    console.log("🔗 Creating Supabase client (global singleton)");
    globalThis.supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });
  } else {
    globalThis.supabaseClientInstance = null;
  }
}

if (!globalThis.supabaseAdminClientInstance) {
  if (supabaseUrl && supabaseServiceRoleKey && supabaseUrl.startsWith('https://')) {
    console.log("🔗 Creating Supabase admin client (global singleton)");
    globalThis.supabaseAdminClientInstance = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  } else {
    globalThis.supabaseAdminClientInstance = null;
  }
}

export const supabase = globalThis.supabaseClientInstance;
export const supabaseAdmin = globalThis.supabaseAdminClientInstance;