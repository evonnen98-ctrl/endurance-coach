import { supabase } from '../lib/supabase.js'

const userId = '00000000-0000-0000-0000-000000000001'

async function seed() {
  // Find 3 upcoming planned sessions to modify
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'planned')
    .in('session_type', ['interval', 'tempo', 'long'])
    .order('scheduled_date')
    .limit(3)

  if (error || !sessions?.length) {
    console.error('No planned sessions found — generate a plan first.', error)
    process.exit(1)
  }

  const modifications = [
    {
      title: 'Easy Recovery Run',
      session_type: 'recovery',
      duration_minutes: 30,
      distance_km: 4,
      effort_zone: 'Zone 1–2',
      modification_reason: 'Dropped intensity based on your RPE feedback — two high sessions in a row. Coach wants you fresh for next week.',
    },
    {
      title: 'Steady Aerobic Run',
      session_type: 'easy',
      duration_minutes: 45,
      distance_km: 7,
      effort_zone: 'Zone 2',
      modification_reason: 'Swapped tempo for aerobic work this week. You mentioned leg fatigue — building base instead of pushing threshold.',
    },
    {
      title: 'Short Long Run',
      session_type: 'long',
      duration_minutes: 70,
      distance_km: 11,
      effort_zone: 'Zone 2',
      modification_reason: 'Reduced long run by 20% after your check-in. Keeping the long session but at lower volume to manage load.',
    },
  ]

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    const mod = modifications[i]

    await supabase.from('sessions').update({
      title:              mod.title,
      session_type:       mod.session_type,
      duration_minutes:   mod.duration_minutes,
      distance_km:        mod.distance_km,
      effort_zone:        mod.effort_zone,
      status:             'modified',
      original_data:      s,
      modification_reason: mod.modification_reason,
    }).eq('id', s.id)

    console.log(`Modified: ${s.title} (${s.scheduled_date}) → ${mod.title}`)
  }

  console.log(`\nDone. ${sessions.length} sessions modified. The Plan tab will show Current/Original toggle.`)
}

seed().catch(console.error)
