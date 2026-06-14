import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
// Use service role key if set (bypasses RLS, which is disabled per schema.sql for this demo).
// Falls back to anon key for local dev without the service role key configured.
const supabaseKey = (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
