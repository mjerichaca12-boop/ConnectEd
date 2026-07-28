import { createClient } from "@supabase/supabase-js";

const BUILD_SOURCE = "root";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const SUPABASE_AUTH_STORAGE_KEY = "connected-supabase-auth-token";
const APP_URL = String(import.meta.env.VITE_APP_URL || "").trim();

const getAppOrigin = () => {
  if (APP_URL) {
    try {
      return new URL(APP_URL).origin;
    } catch {
      // Fall back to runtime origin when VITE_APP_URL is malformed.
    }
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return "";
};

export const getAuthRedirectUrl = (path = "") => {
  const base = getAppOrigin();
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  if (!base) return normalizedPath ? `/${normalizedPath}` : "/";
  return normalizedPath ? `${base}/${normalizedPath}` : base;
};

console.log(`[ConnectEd] build source: ${BUILD_SOURCE}`);
console.log("🔍 Supabase Config Debug:");
console.log("  VITE_SUPABASE_URL:", supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "MISSING");
console.log("  VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : "MISSING");


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
        storageKey: SUPABASE_AUTH_STORAGE_KEY,
        storage: window.localStorage
      }
    });

    // Patch removeChannel to prevent "WebSocket is closed before the connection is established" error
    // which happens during fast unmounts (like React StrictMode or quick navigation)
    const originalRemoveChannel = globalThis.supabaseClientInstance.removeChannel;
    globalThis.supabaseClientInstance.removeChannel = function(channel) {
      setTimeout(() => {
        try {
          originalRemoveChannel.call(this, channel);
        } catch (e) {
          // ignore
        }
      }, 500);
    };

  } else {
    globalThis.supabaseClientInstance = null;
  }
}

export const supabase = globalThis.supabaseClientInstance;