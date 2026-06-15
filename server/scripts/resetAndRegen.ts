import { createClient } from '@supabase/supabase-js'
import { buildUserContext } from '../services/userContext.js'
import { generatePlanSkeleton } from '../services/ai/planGeneration.js'

const sb = createClient(
  'https://wuidlwwgafgomhztqodo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aWRsd3dnYWZnb21oenRxb2RvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTI0NjQwOCwiZXhwIjoyMDk2ODIyNDA4fQ.o7mavlfJrIzvhbVJqgRFa25cXslYAef7t_UJ18Ph0HU'
)
const DEMO_USER = '00000000-0000-0000-0000-000000000001'

async function main() {
  console.log('0. Deleting workout_logs (FK)...')
  const { error: e0 } = await sb.from('workout_logs').delete().eq('user_id', DEMO_USER)
  if (e0) { console.error('workout_logs delete error:', e0.message); process.exit(1) }

  console.log('0b. Deleting checkins (FK)...')
  await sb.from('checkins').delete().eq('user_id', DEMO_USER)

  console.log('1. Deleting existing sessions...')
  const { error: e1 } = await sb.from('sessions').delete().eq('user_id', DEMO_USER)
  if (e1) { console.error('sessions delete error:', e1.message); process.exit(1) }

  console.log('2. Deleting existing training plans...')
  const { error: e2 } = await sb.from('training_plans').delete().eq('user_id', DEMO_USER)
  if (e2) { console.error('plans delete error:', e2.message); process.exit(1) }

  console.log('3. Building user context...')
  const context = await buildUserContext(DEMO_USER)
  console.log('   Goal:', context.goal?.event_type, '| target:', context.goal?.target_date)
  console.log('   Current km: ride', (context.user.preferences as any).ride_weekly_km, 'run', (context.user.preferences as any).run_weekly_km, 'swim', (context.user.preferences as any).swim_weekly_km)

  console.log('4. Generating new plan...')
  await generatePlanSkeleton(DEMO_USER, context, (msg) => console.log('  >', msg))

  console.log('5. Verifying long ride distances...')
  const { data: rides } = await sb.from('sessions')
    .select('week_number, distance_km, title')
    .eq('user_id', DEMO_USER)
    .eq('discipline', 'ride')
    .ilike('title', '%long%')
    .order('week_number')

  console.log('\n── RIDE LONG SESSIONS (NEW PLAN) ────────────────────────')
  for (const r of (rides ?? [])) {
    const marker = [1, 8, 16, 18, 20].includes(r.week_number) ? '→' : ' '
    console.log(`${marker} W${String(r.week_number).padStart(2)}: ${r.distance_km}km`)
  }

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
