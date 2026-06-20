import { Router } from 'express'
import { supabase } from '../lib/supabase.js'

const router = Router()

// POST /api/onboarding/save
// Saves user preferences and goal, deletes old plans (FK-safe order).
// Called from the browser before plan generation — uses service role key server-side.
router.post('/save', async (req, res) => {
  const {
    userId,
    disciplines,
    phase,
    preferences,
    eventType,
    targetDate,
    name,
  } = req.body as {
    userId: string
    disciplines: string[]
    phase: string
    preferences: Record<string, unknown>
    eventType: string
    targetDate: string
    name: string
  }

  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    // Delete old plans — respect FK order (no CASCADE on workout_logs/checkins)
    const { data: oldPlans } = await supabase
      .from('training_plans').select('id').eq('user_id', userId)
    if (oldPlans?.length) {
      const oldIds = oldPlans.map((p: { id: string }) => p.id)
      const { data: oldSessions } = await supabase
        .from('sessions').select('id').in('plan_id', oldIds)
      if (oldSessions?.length) {
        const sIds = oldSessions.map((s: { id: string }) => s.id)
        await supabase.from('workout_logs').delete().in('session_id', sIds)
        await supabase.from('checkins').delete().in('session_id', sIds)
      }
      await supabase.from('coach_notes').delete().in('plan_id', oldIds)
      await supabase.from('sessions').delete().in('plan_id', oldIds)
      await supabase.from('training_plans').delete().in('id', oldIds)
    }

    // Update user row (always exists for demo; UPDATE avoids RLS INSERT restriction)
    const { error: userErr } = await supabase.from('users').update({
      name:                 name || 'Athlete',
      disciplines,
      training_phase:       phase,
      preferences,
      onboarding_complete:  false,
    }).eq('id', userId)
    if (userErr) return res.status(500).json({ error: userErr.message })

    // Update goal row (always exists for demo seed)
    const { error: goalErr } = await supabase.from('goals').update({
      discipline:  disciplines.length > 1 ? 'triathlon' : disciplines[0],
      event_type:  eventType || null,
      target_date: targetDate || null,
      status:      'active',
    }).eq('user_id', userId)
    if (goalErr) return res.status(500).json({ error: goalErr.message })

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/onboarding/complete
// Sets onboarding_complete = true after plan generation finishes.
router.post('/complete', async (req, res) => {
  const { userId } = req.body as { userId: string }
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const { error } = await supabase
    .from('users')
    .update({ onboarding_complete: true })
    .eq('id', userId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router
