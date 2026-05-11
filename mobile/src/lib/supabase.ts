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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
