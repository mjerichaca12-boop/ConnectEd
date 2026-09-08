import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import 'react-native-url-polyfill/auto'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://replace-this.supabase.co"
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.replace-this"

const ExpoSSRStorage = {
  getItem: (key: string) => { return Promise.resolve(null); },
  setItem: (key: string, value: string) => { return Promise.resolve(); },
  removeItem: (key: string) => { return Promise.resolve(); },
};

const customStorage = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' ? window.localStorage : ExpoSSRStorage)
  : AsyncStorage;

export const isConnectionLostError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = (
    typeof err === 'string'
      ? err
      : (err as any)?.message || (err as any)?.name || String(err)
  ).toLowerCase();

  return (
    msg.includes('network connection was lost') ||
    msg.includes('connection was lost') ||
    msg.includes('unexpectedexception') ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout')
  );
};

export const resilientFetch: typeof fetch = async (input, init) => {
  const maxRetries = 3;
  let attempt = 0;
  let delayMs = 300;

  while (true) {
    try {
      return await fetch(input, init);
    } catch (err: unknown) {
      attempt++;
      if (attempt < maxRetries && isConnectionLostError(err)) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }
      throw err;
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: resilientFetch,
  },
});

