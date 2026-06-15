import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://wuidlwwgafgomhztqodo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aWRsd3dnYWZnb21oenRxb2RvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0NjQwOCwiZXhwIjoyMDk2ODIyNDA4fQ.o7mavlfJrIzvhbVJqgRFa25cXslYAef7t_UJ18Ph0HU'
)
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
