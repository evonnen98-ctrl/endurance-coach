import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import type { UserContext } from '../userContext.js'

const client = new Anthropic()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

  const prompt = `You are an endurance coach reviewing whether upcoming sessions need adjustment based on recent athlete data.

ATHLETE: ${context.user.name}
CURRENT WEEK: ${context.current_week}
INJURY FLAGS: ${context.injury_flags}
RECENT CHECK-INS: ${context.recent_checkins.slice(0, 4).map(c => `${c.date}: ${c.feeling_label}${c.soreness_notes ? ` (${c.soreness_notes})` : ''}`).join(' | ')}
RECENT WORKOUTS: ${context.recent_workouts.slice(0, 5).map(w => `${w.date}: ${w.discipline} ${w.session_type} — RPE ${w.rpe ?? '?'}${w.deviation ? `, ${w.deviation}` : ''} — "${w.note ?? 'no note'}"`).join('\n')}

UPCOMING SESSIONS (next 14 days):
${upcomingSessions.map((s: any) => `- ${s.scheduled_date} (${s.id}): ${s.title} — ${s.duration_minutes}min, ${s.effort_zone ?? 'unknown'}`).join('\n')}

Based on this data, identify at most 2-3 sessions that should be modified. Only suggest modifications if there is clear evidence from the data (fatigue pattern, injury, significant over/under performance).

Return JSON:
{
  "adjustments": [
    {
      "session_id": "uuid",
      "new_title": "Modified title",
      "new_description": "What changed",
      "new_duration_minutes": 45,
      "new_effort_zone": "Z1-Z2",
      "modification_reason": "Clear explanation of why this change was made"
    }
  ]
}

If no adjustments are needed, return: {"adjustments": []}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
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
      title: adj.new_title ?? original.title,
      description: adj.new_description ?? original.description,
      duration_minutes: adj.new_duration_minutes ?? original.duration_minutes,
      effort_zone: adj.new_effort_zone ?? original.effort_zone,
      status: 'modified',
      original_data: original,
      modification_reason: adj.modification_reason,
    }).eq('id', adj.session_id)
  }
}
