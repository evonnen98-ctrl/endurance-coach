import Anthropic from '@anthropic-ai/sdk'
import type { UserContext } from '../userContext.js'
import { supabase } from '../../lib/supabase.js'
import { COACH_SYSTEM_PROMPT } from './coachingPrompt.js'

const client = new Anthropic()

const FEELING_LABELS: Record<number, string> = { 1: 'terrible', 2: 'poor', 3: 'okay', 4: 'good', 5: 'great' }

export async function generateCheckinResponse(
  checkinId: string,
  feeling: number,
  soreness_notes: string | undefined,
  todaySessionId: string | undefined,
  context: UserContext
) {
  let todaySession: any = null
  if (todaySessionId) {
    const { data } = await supabase.from('sessions').select('*').eq('id', todaySessionId).single()
    todaySession = data
  }

  const prompt = `An athlete has submitted their morning check-in.

ATHLETE: ${context.user.name}
TODAY'S FEELING: ${FEELING_LABELS[feeling]} (${feeling}/5)
SORENESS/ISSUES: ${soreness_notes || 'none reported'}
TODAY'S PLANNED SESSION: ${todaySession
  ? `${todaySession.title} — ${todaySession.description ?? ''} (${todaySession.duration_minutes}min, ${todaySession.effort_zone ?? 'unknown effort'})`
  : 'rest day'}

RECENT CONTEXT:
- Week ${context.current_week} of training
- Goal: ${context.goal?.event_type ?? 'build fitness'}, ${context.goal?.days_until_event ?? 'unknown'} days out
- Last 3 check-ins: ${context.recent_checkins.slice(0, 3).map(c => `${c.date}: ${c.feeling_label}${c.soreness_notes ? ` (${c.soreness_notes})` : ''}`).join(' | ')}
- Injury flags: ${context.injury_flags ? 'YES — be conservative' : 'none'}

Rules:
- Feeling 4-5 with no issues: confirm today's session in 1-2 sentences.
- Feeling 3 with soreness: acknowledge it, suggest monitoring or minor mod, keep session.
- Feeling 1-2: suggest a real modification (reduce intensity, shorten, or swap to easy alternative) and explain why.

Return JSON:
{
  "coach_response": "Your 1-2 sentence response here",
  "plan_adjusted": false,
  "adjustment_details": null
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      coach_response: "Thanks for checking in. Listen to your body today and let me know how the session goes.",
      plan_adjusted: false,
      adjustment_details: null,
    }
  }

  return JSON.parse(jsonMatch[0])
}
