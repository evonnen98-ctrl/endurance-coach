import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { addDays, format, parseISO } from 'date-fns'
import type { UserContext } from '../userContext.js'

const client = new Anthropic()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface GeneratedSession {
  day_of_week: number
  discipline: string
  session_type: string
  title: string
  description: string
  duration_minutes: number
  distance_km?: number
  target_pace?: string
  target_power?: string
  effort_zone?: string
  session_structure: Array<{ description: string }>
  coaching_rationale: string
}

interface GeneratedWeek {
  week_number: number
  sessions: GeneratedSession[]
}

export async function generatePlan(userId: string, context: UserContext) {
  const prompt = `You are an expert endurance coach generating a personalised 12-week training plan.

ATHLETE PROFILE:
- Name: ${context.user.name}
- Disciplines: ${context.user.disciplines.join(', ')}
- Training phase: ${context.user.training_phase}
- Training style: ${context.user.training_style}
- FTP: ${context.user.ftp ? `${context.user.ftp}w` : 'unknown'}
- Swim environment: ${context.user.swim_pool_or_open ?? 'pool'}
- Goal: ${context.goal?.event_type ?? 'Build fitness'}
- Days until event: ${context.goal?.days_until_event ?? 84}
- Coach notes: ${context.user.coach_notes_freetext ?? 'none'}
- Current preferences: ${JSON.stringify(context.user.preferences)}

Generate a complete 12-week training plan. The plan must follow periodisation principles:
- Weeks 1-3: Base building
- Weeks 4-6: Build 1 (volume + some intensity)
- Weeks 7-9: Build 2 (peak intensity)
- Weeks 10-11: Peak then taper
- Week 12: Race week (very light)

Weekly structure (0=Mon, 6=Sun):
- Monday (0): Swim
- Tuesday (1): Ride
- Wednesday (2): Run
- Thursday (3): Swim
- Friday (4): Rest
- Saturday (5): Brick or long ride
- Sunday (6): Long run

Return ONLY valid JSON with this exact schema:
{
  "weeks": [
    {
      "week_number": 1,
      "sessions": [
        {
          "day_of_week": 0,
          "discipline": "swim",
          "session_type": "Aerobic",
          "title": "Swim — Aerobic",
          "description": "2.5 km steady",
          "duration_minutes": 50,
          "distance_km": 2.5,
          "target_pace": "1:55/100m",
          "effort_zone": "Z2",
          "session_structure": [{"description": "400m warm-up easy"}, {"description": "1500m continuous aerobic"}, {"description": "200m cool down"}],
          "coaching_rationale": "Easy aerobic swim to open the block."
        }
      ]
    }
  ]
}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  // strip markdown code fences if present, then find the JSON object
  const stripped = text.replace(/```(?:json)?\n?/g, '')
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in plan generation response')

  const plan: { weeks: GeneratedWeek[] } = JSON.parse(jsonMatch[0])

  // Get the active plan
  const { data: activePlan } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!activePlan) {
    // Create a new plan if none exists
    const startDate = format(new Date(), 'yyyy-MM-dd')
    const endDate = format(addDays(new Date(), 83), 'yyyy-MM-dd')
    const { data: newPlan } = await supabase
      .from('training_plans')
      .insert({ user_id: userId, start_date: startDate, end_date: endDate, total_weeks: 12, status: 'active' })
      .select()
      .single()

    if (!newPlan) throw new Error('Failed to create training plan')

    const planStart = parseISO(startDate)
    const sessions = plan.weeks.flatMap(week =>
      week.sessions.map(s => ({
        plan_id: newPlan.id,
        user_id: userId,
        week_number: week.week_number,
        day_of_week: s.day_of_week,
        scheduled_date: format(addDays(planStart, (week.week_number - 1) * 7 + s.day_of_week), 'yyyy-MM-dd'),
        discipline: s.discipline,
        session_type: s.session_type,
        title: s.title,
        description: s.description,
        duration_minutes: s.duration_minutes,
        distance_km: s.distance_km ?? null,
        target_pace: s.target_pace ?? null,
        target_power: s.target_power ?? null,
        effort_zone: s.effort_zone ?? null,
        session_structure: s.session_structure,
        coaching_rationale: s.coaching_rationale,
        status: 'planned',
      }))
    )

    await supabase.from('sessions').insert(sessions)
  }
}
