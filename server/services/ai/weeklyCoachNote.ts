import Anthropic from '@anthropic-ai/sdk'
import { format, addDays, parseISO } from 'date-fns'
import type { UserContext } from '../userContext.js'
import { supabase } from '../../lib/supabase.js'
import { COACH_SYSTEM_PROMPT } from './coachingPrompt.js'

const client = new Anthropic()

export async function generateWeeklyCoachNote(
  userId: string,
  planId: string,
  weekNumber: number,
  context: UserContext
) {
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*, workout_logs(*)')
    .eq('user_id', userId)
    .eq('week_number', weekNumber)

  const { data: checkins } = await supabase
    .from('checkins')
    .select('*')
    .eq('user_id', userId)
    .order('checkin_date', { ascending: false })
    .limit(7)

  const plan = await supabase
    .from('training_plans')
    .select('start_date')
    .eq('id', planId)
    .single()

  const planStart = plan.data?.start_date ? parseISO(plan.data.start_date) : new Date()
  const weekStart = addDays(planStart, (weekNumber - 1) * 7)
  const weekEnd   = addDays(weekStart, 6)

  const sessionsData = (sessions ?? []).map((s: any) => ({
    discipline:   s.discipline,
    title:        s.title,
    status:       s.status,
    effort_zone:  s.effort_zone,
    planned_km:   s.distance_km,
    planned_min:  s.duration_minutes,
    actual_km:    s.workout_logs?.[0]?.actual_distance_km,
    actual_min:   s.workout_logs?.[0]?.actual_duration_minutes,
    rpe:          s.workout_logs?.[0]?.rpe,
    note:         s.workout_logs?.[0]?.user_note,
  }))

  const checkinsData = (checkins ?? []).slice(0, 7)

  const sessionsCompleted = sessionsData.filter(s => s.status === 'complete').length
  const sessionsMissed    = sessionsData.filter(s => s.status === 'missed').length

  const prompt = `Write a weekly training review for this athlete. Reference actual data — no generic observations.

ATHLETE: ${context.user.name}
WEEK: ${weekNumber} of 12 | ${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}
GOAL: ${context.goal?.event_type ?? 'fitness'}, ${context.goal?.days_until_event ?? '?'} days out
COMPLETION: ${sessionsCompleted} completed, ${sessionsMissed} missed
${context.user.coach_notes_freetext ? `ATHLETE PREFERENCES: "${context.user.coach_notes_freetext}" — reference these when they are relevant to this week's observations.` : ''}

SESSIONS:
${sessionsData.map((s: any) => `- ${s.discipline.toUpperCase()} ${s.title}: ${s.status} | Planned: ${s.planned_km ?? '?'}km/${s.planned_min ?? '?'}min ${s.effort_zone ?? ''} | Actual: ${s.actual_km ?? '?'}km/${s.actual_min ?? '?'}min | RPE: ${s.rpe ?? '?'} | Note: "${s.note ?? 'none'}"`).join('\n')}

CHECK-INS:
${checkinsData.map((c: any) => `- ${c.checkin_date}: feeling ${c.feeling}/5${c.soreness_notes ? `, ${c.soreness_notes}` : ''}`).join('\n')}

Return JSON:
{
  "metric_pills": [
    {"label": "Swim on track", "color": "blue"},
    {"label": "Volume +8%", "color": "green"},
    {"label": "Recovery moderate", "color": "yellow"}
  ],
  "headline": "One punchy sentence — the key story of this week",
  "swim_observations": "2-3 specific sentences on swim performance (null if no swim)",
  "ride_observations": "2-3 specific sentences on bike performance (null if no ride)",
  "run_observations": "2-3 specific sentences on run performance (null if no run)",
  "recovery_assessment": "2-3 sentences on recovery, fatigue, RPE trends",
  "looking_ahead": "2-3 sentences on next week's focus",
  "closing_prompt": "One engaging question to the athlete about this week"
}

Metric pill colors: blue (swim), orange (ride), green (positive), yellow (caution), grey (neutral).
Headline should NOT be generic. Reference a specific number or pattern.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: COACH_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in weekly note response')

  const noteData = JSON.parse(jsonMatch[0])

  await supabase.from('coach_notes').upsert({
    user_id:    userId,
    plan_id:    planId,
    week_number: weekNumber,
    week_start: format(weekStart, 'yyyy-MM-dd'),
    week_end:   format(weekEnd, 'yyyy-MM-dd'),
    ...noteData,
  }, { onConflict: 'user_id,week_number' })
}
