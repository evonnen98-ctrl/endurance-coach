import Anthropic from '@anthropic-ai/sdk'
import type { UserContext } from '../userContext.js'
import { supabase } from '../../lib/supabase.js'
import { COACH_SYSTEM_PROMPT } from './coachingPrompt.js'

const client = new Anthropic()

export async function adjustPlan(userId: string, context: UserContext) {
  const { data: upcomingSessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'planned')
    .gte('scheduled_date', new Date().toISOString().split('T')[0])
    .order('scheduled_date')
    .limit(14)

  if (!upcomingSessions?.length) return

  const prompt = `Review upcoming sessions and identify modifications needed based on recent athlete data.

ATHLETE: ${context.user.name}
CURRENT WEEK: ${context.current_week}
INJURY FLAGS: ${context.injury_flags}
RECENT CHECK-INS: ${context.recent_checkins.slice(0, 4).map(c => `${c.date}: ${c.feeling_label}${c.soreness_notes ? ` (${c.soreness_notes})` : ''}`).join(' | ')}
RECENT WORKOUTS: ${context.recent_workouts.slice(0, 5).map(w => `${w.date}: ${w.discipline} ${w.session_type} RPE ${w.rpe ?? '?'}${w.deviation ? `, ${w.deviation}` : ''} — "${w.note ?? ''}"`).join('\n')}

UPCOMING SESSIONS (next 14 days):
${upcomingSessions.map((s: any) => `- ${s.scheduled_date} (${s.id}): ${s.title} — ${s.duration_minutes}min ${s.effort_zone ?? ''}`).join('\n')}

Only modify sessions when there is clear evidence of fatigue, injury, or over-performance pattern.
Hard rule: never two hard sessions back to back.
Modify at most 2-3 sessions.

If no adjustment needed, return: {"adjustments": []}

Return JSON:
{
  "adjustments": [
    {
      "session_id": "uuid",
      "new_title": "Modified title",
      "new_description": "What changed and why",
      "new_duration_minutes": 45,
      "new_effort_zone": "Zone 1-2",
      "modification_reason": "Clear explanation referencing the data that triggered this"
    }
  ]
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return

  const { adjustments } = JSON.parse(jsonMatch[0])
  if (!adjustments?.length) return

  for (const adj of adjustments) {
    const { data: original } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', adj.session_id)
      .single()

    if (!original) continue

    await supabase.from('sessions').update({
      title:             adj.new_title ?? original.title,
      description:       adj.new_description ?? original.description,
      duration_minutes:  adj.new_duration_minutes ?? original.duration_minutes,
      effort_zone:       adj.new_effort_zone ?? original.effort_zone,
      status:            'modified',
      original_data:     original,
      modification_reason: adj.modification_reason,
    }).eq('id', adj.session_id)
  }
}
