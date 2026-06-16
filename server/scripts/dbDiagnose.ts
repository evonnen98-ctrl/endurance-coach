import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env')

const sb = createClient(url, key)
const DEMO_USER = '00000000-0000-0000-0000-000000000001'

async function main() {
  // 1. Current ride long sessions
  const { data: rides } = await sb.from('sessions')
    .select('week_number, discipline, session_type, distance_km, title')
    .eq('user_id', DEMO_USER)
    .eq('discipline', 'ride')
    .ilike('title', '%long%')
    .order('week_number')

  console.log('\n── RIDE LONG SESSIONS IN DB ─────────────────────────────')
  for (const r of (rides ?? [])) {
    console.log(`  W${String(r.week_number).padStart(2)}: ${r.title} — ${r.distance_km}km`)
  }

  // 2. Plan info
  const { data: plan } = await sb.from('training_plans')
    .select('id, start_date, end_date, total_weeks, status, created_at')
    .eq('user_id', DEMO_USER)
    .maybeSingle()
  console.log('\n── ACTIVE PLAN ──────────────────────────────────────────')
  console.log(plan ? JSON.stringify(plan, null, 2) : '  No plan found')
}

main().catch(console.error)
