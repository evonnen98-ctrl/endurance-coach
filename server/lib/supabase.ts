import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

// Single server-side Supabase client (service role, bypasses RLS).
// ws is provided explicitly because Node 20 has no native WebSocket.
export const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    global: { WebSocket: WebSocket as unknown as typeof globalThis.WebSocket },
    auth: { persistSession: false, autoRefreshToken: false },
  }
)
