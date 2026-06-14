import Anthropic from '@anthropic-ai/sdk'
import type { UserContext } from '../userContext.js'
import { supabase } from '../../lib/supabase.js'
import { COACH_SYSTEM_PROMPT } from './coachingPrompt.js'

const client = new Anthropic()

export async function generatePostWorkoutResponse(
  workoutLogId: string,
  sessionId: string | undefined,
  rpe: number,
  user_note: string | undefined,
  actual_distance_km: number | undefined,
  actual_duration_minutes: number | undefined,
  context: UserContext
) {
  let plannedSession: any = null
  if (sessionId) {
    const { data } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
    plannedSession = data
  }

  const deviation = (() => {
    if (!plannedSession || !actual_distance_km || !plannedSession.distance_km) return null
    const diff = ((actual_distance_km - plannedSession.distance_km) / plannedSession.distance_km) * 100
    if (Math.abs(diff) < 5) return null
    return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs planned distance`
  })()

  const prompt = `Athlete just completed a workout. Respond in 2-3 sentences. Be specific to the data — no generic praise.

ATHLETE: ${context.user.name}
COMPLETED: ${plannedSession?.title ?? 'workout'}
PLANNED: ${plannedSession?.distance_km ?? '?'}km / ${plannedSession?.duration_minutes ?? '?'}min / ${plannedSession?.effort_zone ?? '?'} / ${plannedSession?.description ?? ''}
ACTUAL: ${actual_distance_km ?? '?'}km / ${actual_duration_minutes ?? '?'}min
RPE: ${rpe}/10 (planned effort: ${plannedSession?.effort_zone ?? 'unknown'})
ATHLETE'S NOTE: "${user_note || 'no note'}"
DEVIATION: ${deviation ?? 'on target'}
WEEK: ${context.current_week} of 12 — ${context.goal?.event_type ?? 'fitness'} in ${context.goal?.days_until_event ?? '?'} days

Instructions:
- If RPE matches planned effort zone: acknowledge execution quality briefly.
- If RPE > 7 on a Zone 2 session: call it out specifically — reference the zone and RPE number.
- If distance significantly off: comment on it directly.
- If athlete's note mentions something specific: respond to it.
- End with one forward-looking sentence about what's next or what to monitor.

Return JSON: { "coach_response": "your 2-3 sentence response" }`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { coach_response: "Good work completing that session. I'll factor this into your upcoming training." }
  }

  return JSON.parse(jsonMatch[0])
}
