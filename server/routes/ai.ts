import { Router } from 'express'
import { buildUserContext } from '../services/userContext.js'
import { generatePlan } from '../services/ai/planGeneration.js'
import { generateCheckinResponse } from '../services/ai/checkinResponse.js'
import { generatePostWorkoutResponse } from '../services/ai/postWorkoutResponse.js'
import { generateWeeklyCoachNote } from '../services/ai/weeklyCoachNote.js'
import { adjustPlan } from '../services/ai/planAdjustment.js'
import { generateGoalCompletion } from '../services/ai/goalCompletion.js'

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
