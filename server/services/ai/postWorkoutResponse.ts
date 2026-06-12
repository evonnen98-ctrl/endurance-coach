import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { UserContext } from '../userContext.js'

const client = new Anthropic()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const prompt = `You are an elite endurance coach responding to a completed workout. Keep your response to 2-3 sentences maximum. Be direct, specific, and avoid generic praise.

ATHLETE: ${context.user.name}
COMPLETED: ${plannedSession?.title ?? 'workout'}
PLANNED: ${plannedSession?.distance_km ?? '?'} km / ${plannedSession?.duration_minutes ?? '?'} min / ${plannedSession?.effort_zone ?? '?'}
ACTUAL: ${actual_distance_km ?? '?'} km / ${actual_duration_minutes ?? '?'} min
RPE: ${rpe}/10
ATHLETE'S NOTE: "${user_note || 'no note'}"
DEVIATION: ${deviation ?? 'on target'}
WEEK: ${context.current_week} — Goal: ${context.goal?.event_type ?? 'fitness'} in ${context.goal?.days_until_event ?? '?'} days

Instructions:
- If RPE matches the planned effort zone: acknowledge the execution quality briefly
- If RPE was high for a Z2 session: note the extra effort and what it means for recovery
- If distance was significantly off: comment on that specifically
- If athlete's note mentions something specific: respond to it directly
- End with one forward-looking sentence about what comes next or what to watch for

Return JSON: { "coach_response": "your 2-3 sentence response" }`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { coach_response: "Good work completing that session. I'll factor this into your upcoming training." }
  }

  return JSON.parse(jsonMatch[0])
}
