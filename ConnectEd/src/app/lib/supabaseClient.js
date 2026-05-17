import { createClient } from "@supabase/supabase-js";

const BUILD_SOURCE = "nested";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

console.log(`[ConnectEd] build source: ${BUILD_SOURCE}`);
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

// Clean up stale session tokens from URL
// If URL contains auth parameters that are too old, remove them to prevent 403 errors
const cleanupStaleUrlSession = () => {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1));
    const expiresAt = params.get('expires_at');
    
    if (expiresAt) {
      const expiresAtSeconds = parseInt(expiresAt, 10);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ageSeconds = nowSeconds - expiresAtSeconds;
      
      if (ageSeconds > 120) {
        console.warn(`[supabaseClient] Removing stale session from URL (age: ${ageSeconds}s)`);
        // Clear the hash to remove the stale session
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }
};

cleanupStaleUrlSession();

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

    // Handle auth errors gracefully
    globalThis.supabaseClientInstance.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        // Clear any stale tokens from localStorage
        try {
          localStorage.removeItem(`sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`);
        } catch (e) {
          console.warn('[supabaseClient] Could not clear auth token:', e);
        }
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
    console.warn(
      "⚠️ Supabase admin client not initialized. " +
      "VITE_SUPABASE_SERVICE_ROLE_KEY is", 
      supabaseServiceRoleKey ? "SET" : "MISSING"
    );
    // Create a null proxy that logs errors when admin operations are attempted
    globalThis.supabaseAdminClientInstance = {
      auth: {
        admin: {
          createUser: async () => {
            throw new Error(
              "Admin operations not available: VITE_SUPABASE_SERVICE_ROLE_KEY not configured. " +
              "Teacher registration via admin requires the service role key in environment variables."
            );
          },
          deleteUser: async () => {
            throw new Error(
              "Admin operations not available: VITE_SUPABASE_SERVICE_ROLE_KEY not configured."
            );
          }
        }
      },
      from: () => ({ select: () => Promise.reject(new Error("Admin client not configured")) })
    };
  }
}

export const supabase = globalThis.supabaseClientInstance;
export const supabaseAdmin = globalThis.supabaseAdminClientInstance;