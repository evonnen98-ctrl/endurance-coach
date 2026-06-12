import { createClient } from '@supabase/supabase-js'
import { differenceInDays, parseISO } from 'date-fns'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface UserContext {
  user: {
    name: string
    disciplines: string[]
    training_phase: string
    training_style: string
    ftp?: number
    swim_pool_or_open?: string
    injury_notes?: string
    coach_notes_freetext?: string
    preferences: Record<string, string | number>
  }
  goal?: {
    event_type?: string
    target_date?: string
    days_until_event?: number
  }
  current_week: number
  recent_workouts: Array<{
    date: string
    discipline: string
    session_type: string
    planned_distance_km?: number
    actual_distance_km?: number
    planned_duration?: number
    actual_duration?: number
    rpe?: number
    note?: string
    deviation?: string
  }>
  recent_checkins: Array<{
    date: string
    feeling: number
    feeling_label: string
    soreness_notes?: string
  }>
  injury_flags: boolean
}

const FEELING_LABELS: Record<number, string> = {
  1: 'terrible',
  2: 'poor',
  3: 'okay',
  4: 'good',
  5: 'great',
}

export async function buildUserContext(userId: string): Promise<UserContext> {
  const [userRes, goalRes, planRes, logsRes, checkinsRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('goals').select('*').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('training_plans').select('*').eq('user_id', userId).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('workout_logs').select('*, sessions(*)').eq('user_id', userId).order('logged_at', { ascending: false }).limit(20),
    supabase.from('checkins').select('*').eq('user_id', userId).order('checkin_date', { ascending: false }).limit(7),
  ])

  const user = userRes.data
  const goal = goalRes.data
  const plan = planRes.data
  const logs = (logsRes.data ?? []) as any[]
  const checkins = (checkinsRes.data ?? []) as any[]

  // Determine current week number
  let currentWeek = 1
  if (plan?.start_date) {
    const daysSinceStart = differenceInDays(new Date(), parseISO(plan.start_date))
    currentWeek = Math.max(1, Math.ceil((daysSinceStart + 1) / 7))
  }

  const recent_workouts = logs.slice(0, 12).map(log => {
    const session = log.sessions
    const planned = session?.distance_km
    const actual = log.actual_distance_km
    let deviation: string | undefined
    if (planned && actual) {
      const diff = ((actual - planned) / planned) * 100
      if (Math.abs(diff) > 5) deviation = `${diff > 0 ? '+' : ''}${diff.toFixed(0)}% vs planned`
    }
    return {
      date: log.logged_at?.split('T')[0],
      discipline: session?.discipline ?? 'unknown',
      session_type: session?.session_type ?? 'unknown',
      planned_distance_km: planned,
      actual_distance_km: log.actual_distance_km,
      planned_duration: session?.duration_minutes,
      actual_duration: log.actual_duration_minutes,
      rpe: log.rpe,
      note: log.user_note,
      deviation,
    }
  })

  const recent_checkins = checkins.map(c => ({
    date: c.checkin_date,
    feeling: c.feeling,
    feeling_label: FEELING_LABELS[c.feeling] ?? 'okay',
    soreness_notes: c.soreness_notes,
  }))

  const injury_flags = logs.some(l => l.injury_flag)

  return {
    user: {
      name: user?.name ?? 'Athlete',
      disciplines: user?.disciplines ?? [],
      training_phase: user?.training_phase ?? 'build',
      training_style: user?.training_style ?? 'moderate',
      ftp: user?.ftp,
      swim_pool_or_open: user?.swim_pool_or_open,
      injury_notes: user?.injury_notes,
      coach_notes_freetext: user?.coach_notes_freetext,
      preferences: user?.preferences ?? {},
    },
    goal: goal
      ? {
          event_type: goal.event_type,
          target_date: goal.target_date,
          days_until_event: goal.target_date
            ? differenceInDays(parseISO(goal.target_date), new Date())
            : undefined,
        }
      : undefined,
    current_week: currentWeek,
    recent_workouts,
    recent_checkins,
    injury_flags,
  }
}

export { supabase }
