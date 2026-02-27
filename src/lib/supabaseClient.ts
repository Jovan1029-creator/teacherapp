// src\lib\supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const fallbackUrl = 'https://example.supabase.co'
const fallbackKey = 'demo-anon-key'

if (!supabaseUrl || !supabaseAnonKey) {
  // Keep the app bootable and surface a clear warning during local setup.
  // Real requests will fail until the env vars are configured.
  console.warn('Missing Supabase env vars: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl || fallbackUrl, supabaseAnonKey || fallbackKey)
