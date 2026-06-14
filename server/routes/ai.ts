import { Router } from 'express'
import { buildUserContext } from '../services/userContext.js'
import { generatePlan, generatePlanSkeleton } from '../services/ai/planGeneration.js'
import { generateCheckinResponse } from '../services/ai/checkinResponse.js'
import { generatePostWorkoutResponse } from '../services/ai/postWorkoutResponse.js'
import { generateWeeklyCoachNote } from '../services/ai/weeklyCoachNote.js'
import { adjustPlan } from '../services/ai/planAdjustment.js'
import { generateGoalCompletion } from '../services/ai/goalCompletion.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

router.post('/generate-plan', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })
    const context = await buildUserContext(userId)
    await generatePlan(userId, context)
    res.json({ success: true })
  } catch (err: any) {
    console.error('generate-plan error:', err)
    res.status(500).json({ error: err.message ?? 'Plan generation failed' })
  }
})

router.get('/generate-plan-stream', async (req, res) => {
  const userId = req.query.userId as string
  if (!userId) { res.status(400).json({ error: 'userId required' }); return }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const t0 = Date.now()
  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  const hardTimeout = setTimeout(() => {
    console.warn(`[ai] hard timeout hit at ${Date.now() - t0}ms`)
    send({ type: 'done' })
    res.end()
  }, 20_000)

  try {
    console.log(`[ai] stream start: ${Date.now() - t0}ms`)
    send({ type: 'status', message: 'Building your plan…' })

    console.log(`[ai] building user context: ${Date.now() - t0}ms`)
    const context = await buildUserContext(userId)
    console.log(`[ai] context ready: ${Date.now() - t0}ms`)

    await generatePlanSkeleton(userId, context, (msg) => send({ type: 'status', message: msg }))

    console.log(`[ai] plan done, total: ${Date.now() - t0}ms`)
    send({ type: 'done' })
  } catch (err: any) {
    console.error(`[ai] error at ${Date.now() - t0}ms:`, err.message)
    send({ type: 'error', message: err.message ?? 'Plan generation failed' })
  } finally {
    clearTimeout(hardTimeout)
    res.end()
  }
})

router.post('/checkin-response', async (req, res) => {
  try {
    const { userId, checkinId, feeling, soreness_notes, todaySessionId } = req.body
    if (!userId || !checkinId || feeling == null) {
      return res.status(400).json({ error: 'userId, checkinId, feeling required' })
    }
    const context = await buildUserContext(userId)
    const result = await generateCheckinResponse(checkinId, feeling, soreness_notes, todaySessionId, context)
    res.json(result)
  } catch (err: any) {
    console.error('checkin-response error:', err)
    res.status(500).json({ error: err.message ?? 'Check-in response failed' })
  }
})

router.post('/post-workout', async (req, res) => {
  try {
    const { userId, workoutLogId, sessionId, rpe, user_note, actual_distance_km, actual_duration_minutes } = req.body
    if (!userId || !workoutLogId || rpe == null) {
      return res.status(400).json({ error: 'userId, workoutLogId, rpe required' })
    }
    const context = await buildUserContext(userId)
    const result = await generatePostWorkoutResponse(
      workoutLogId, sessionId, rpe, user_note, actual_distance_km, actual_duration_minutes, context
    )
    res.json(result)
  } catch (err: any) {
    console.error('post-workout error:', err)
    res.status(500).json({ error: err.message ?? 'Post-workout response failed' })
  }
})

router.post('/weekly-note', async (req, res) => {
  try {
    const { userId, weekNumber, planId } = req.body
    if (!userId || !weekNumber || !planId) {
      return res.status(400).json({ error: 'userId, weekNumber, planId required' })
    }
    const context = await buildUserContext(userId)
    await generateWeeklyCoachNote(userId, planId, weekNumber, context)
    res.json({ success: true })
  } catch (err: any) {
    console.error('weekly-note error:', err)
    res.status(500).json({ error: err.message ?? 'Weekly note generation failed' })
  }
})

router.post('/adjust-plan', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })
    const context = await buildUserContext(userId)
    await adjustPlan(userId, context)
    res.json({ success: true })
  } catch (err: any) {
    console.error('adjust-plan error:', err)
    res.status(500).json({ error: err.message ?? 'Plan adjustment failed' })
  }
})

// Auto-adjust: checks triggers and adjusts if conditions are met
router.post('/auto-adjust', async (req, res) => {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const [logsRes, checkinsRes] = await Promise.all([
      supabase
        .from('workout_logs')
        .select('rpe, injury_flag, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(5),
      supabase
        .from('checkins')
        .select('feeling, checkin_date')
        .eq('user_id', userId)
        .order('checkin_date', { ascending: false })
        .limit(4),
    ])

    const logs     = logsRes.data ?? []
    const checkins = checkinsRes.data ?? []

    const consecutiveHighRPE   = logs.length >= 2 && (logs[0].rpe ?? 0) > 8 && (logs[1].rpe ?? 0) > 8
    const injuryFlagged        = logs.some((l: any) => l.injury_flag)
    const consecutiveLowFeeling = checkins.length >= 2 && (checkins[0].feeling ?? 5) <= 2 && (checkins[1].feeling ?? 5) <= 2

    if (!consecutiveHighRPE && !injuryFlagged && !consecutiveLowFeeling) {
      return res.json({ adjusted: false })
    }

    const reason = injuryFlagged
      ? 'Injury flagged — reduced intensity on upcoming sessions'
      : consecutiveHighRPE
      ? 'Two consecutive high-RPE sessions — eased upcoming load'
      : 'Two low-feeling days in a row — recovery block applied'

    const context = await buildUserContext(userId)
    await adjustPlan(userId, context)

    // Store banner in user preferences
    const { data: user } = await supabase.from('users').select('preferences').eq('id', userId).single()
    const prefs = (user?.preferences as Record<string, unknown>) ?? {}
    await supabase.from('users').update({
      preferences: { ...prefs, plan_adjustment_banner: reason }
    }).eq('id', userId)

    res.json({ adjusted: true, reason })
  } catch (err: any) {
    console.error('auto-adjust error:', err)
    res.status(500).json({ error: err.message ?? 'Auto-adjust failed' })
  }
})

router.post('/goal-completion', async (req, res) => {
  try {
    const { userId, goalId } = req.body
    if (!userId || !goalId) return res.status(400).json({ error: 'userId, goalId required' })
    const context = await buildUserContext(userId)
    const result = await generateGoalCompletion(userId, goalId, context)
    res.json({ success: true, ...result })
  } catch (err: any) {
    console.error('goal-completion error:', err)
    res.status(500).json({ error: err.message ?? 'Goal completion failed' })
  }
})

export default router
