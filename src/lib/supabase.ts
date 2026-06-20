import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
// Use anon key in browser — Supabase blocks sb_secret_ format service role keys from browser requests.
// RLS must be disabled on demo tables (see schema.sql) for anon key to write.
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
