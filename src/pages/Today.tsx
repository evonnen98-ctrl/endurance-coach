import { useEffect, useMemo } from 'react'
import { format, differenceInDays, parseISO, subDays } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { User, Session, Goal } from '../types'
import TodaySession from '../components/today/TodaySession'
import WeekStrip from '../components/today/WeekStrip'

const TODAY     = new Date()
const TODAY_STR = format(TODAY, 'yyyy-MM-dd')
const YESTERDAY = format(subDays(TODAY, 1), 'yyyy-MM-dd')

function getGreeting(name?: string): string {
  const h = TODAY.getHours()
  const n = name ? `, ${name}` : ''
  if (h >= 22 || h < 5) return `Late night${n}`
  if (h < 12)           return `Good morning${n}`
  if (h < 17)           return `Good afternoon${n}`
  return `Good evening${n}`
}

function calcStreak(dates: string[]): number {
  if (!dates.length) return 0
  const dateSet = new Set(dates)
  let count = 0
  let check = new Date(TODAY)
  if (!dateSet.has(format(check, 'yyyy-MM-dd'))) {
    check = subDays(check, 1)
  }
  while (dateSet.has(format(check, 'yyyy-MM-dd'))) {
    count++
    check = subDays(check, 1)
  }
  return count
}

const sectionLabel: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--graphite-300)',
}

export default function TodayPage() {
  const queryClient = useQueryClient()

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('*').eq('id', DEMO_USER_ID).single()
      return data as User
    },
  })

  const { data: goal } = useQuery({
    queryKey: ['active-goal'],
    queryFn: async () => {
      const { data } = await supabase
        .from('goals').select('*').eq('user_id', DEMO_USER_ID).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).single()
      return data as Goal | null
    },
  })

  const { data: activePlan } = useQuery({
    queryKey: ['active-plan-id'],
    queryFn: async () => {
      const { data } = await supabase
        .from('training_plans').select('id, start_date, total_weeks').eq('user_id', DEMO_USER_ID).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      return data ?? null
    },
  })

  const { data: recentCompletedDates = [] } = useQuery({
    queryKey: ['streak-dates'],
    queryFn: async () => {
      const cutoff = format(subDays(TODAY, 30), 'yyyy-MM-dd')
      const { data } = await supabase
        .from('sessions')
        .select('scheduled_date')
        .eq('user_id', DEMO_USER_ID)
        .eq('status', 'complete')
        .neq('discipline', 'rest')
        .gte('scheduled_date', cutoff)
        .lte('scheduled_date', TODAY_STR)
      return (data ?? []).map(s => s.scheduled_date as string)
    },
  })

  const activePlanId    = activePlan?.id ?? null
  const planStartDate   = activePlan?.start_date as string | undefined
  const activePlanWeeks = (activePlan?.total_weeks ?? null) as number | null
  const prefs           = (user?.preferences ?? {}) as Record<string, unknown>
  const prePlanMessage  = prefs.pre_plan_message as string | undefined
  const planNotStarted  = planStartDate ? planStartDate > TODAY_STR : false

  const planCurrentWeek = planStartDate && !planNotStarted && activePlanWeeks
    ? Math.min(activePlanWeeks, Math.max(1, Math.floor(differenceInDays(TODAY, parseISO(planStartDate)) / 7) + 1))
    : null

  const planProgressPct = planCurrentWeek && activePlanWeeks
    ? Math.round((planCurrentWeek / activePlanWeeks) * 100)
    : null

  const { data: todaySessions = [] } = useQuery({
    queryKey: ['today-session', TODAY_STR, activePlanId],
    enabled: activePlanId != null,
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions').select('*').eq('plan_id', activePlanId!)
        .eq('scheduled_date', TODAY_STR).order('discipline')
      return (data ?? []) as Session[]
    },
  })

  const { data: weekSessions = [] } = useQuery({
    queryKey: ['week-sessions', TODAY_STR, activePlanId],
    enabled: activePlanId != null,
    queryFn: async () => {
      const dayOfWeek = TODAY.getDay()
      const offset = (dayOfWeek + 6) % 7
      const mon = new Date(TODAY); mon.setDate(TODAY.getDate() - offset)
      const sun = new Date(mon);  sun.setDate(mon.getDate() + 6)
      const { data } = await supabase
        .from('sessions').select('*').eq('plan_id', activePlanId!)
        .gte('scheduled_date', format(mon, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(sun, 'yyyy-MM-dd'))
        .order('day_of_week')
      return (data ?? []) as Session[]
    },
  })

  useEffect(() => {
    if (!activePlanId) return
    async function markMissed() {
      const { data } = await supabase
        .from('sessions').select('id')
        .eq('plan_id', activePlanId!).eq('scheduled_date', YESTERDAY).eq('status', 'planned')
      if (data?.length) {
        await supabase.from('sessions').update({ status: 'missed' }).in('id', data.map(s => s.id))
        queryClient.invalidateQueries({ queryKey: ['week-sessions'] })
      }
    }
    markMissed()
  }, [activePlanId])

  const streak = useMemo(() => calcStreak(recentCompletedDates), [recentCompletedDates])

  const daysUntilRace = goal?.target_date
    ? differenceInDays(parseISO(goal.target_date), TODAY)
    : null

  const hasSessions = todaySessions.length > 0 && !todaySessions.every(s => s.discipline === 'rest')

  const hasHero = goal?.event_type && daysUntilRace !== null

  return (
    <div className="min-h-screen bg-white">

      {/* ── HERO: full-bleed ink countdown ── */}
      {hasHero ? (
        <div style={{ backgroundColor: 'var(--ink)', paddingTop: 48 }}>
          <div className="px-6 pt-5 pb-7">
            <p style={{
              fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700,
              fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--graphite-300)',
            }}>
              {daysUntilRace! < 0 ? 'Days since' : 'Days to go'}
            </p>
            <p className="animate-fade-in" style={{
              fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 900,
              fontSize: 108, lineHeight: 0.85, letterSpacing: '-0.02em',
              color: 'var(--volt)', marginTop: 2,
            }}>
              {Math.abs(daysUntilRace!)}
            </p>
            <p style={{
              fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700,
              fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#FFFFFF', marginTop: 8,
            }}>
              {goal!.event_type}
            </p>

            {planProgressPct !== null && activePlanWeeks && planCurrentWeek && (
              <div className="mt-5">
                <div className="h-px rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${planProgressPct}%`, backgroundColor: 'var(--volt)' }} />
                </div>
                <div className="flex justify-between mt-1.5">
                  <p style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 600, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--graphite-500)' }}>
                    Week {planCurrentWeek}
                  </p>
                  <p style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 600, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--graphite-500)' }}>
                    {activePlanWeeks} weeks total
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ height: 48 }} />
      )}

      {/* ── CONTENT ── */}
      <div className="px-5 pt-6 pb-24 space-y-6">

        {/* Greeting */}
        <div>
          <h1 className="animate-fade-in" style={{
            fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 800,
            fontSize: 28, letterSpacing: '-0.01em', lineHeight: 0.95,
            textTransform: 'uppercase', color: 'var(--ink)',
          }}>
            {getGreeting(user?.name)}
          </h1>
          <p className="mt-1.5 text-[13px] font-medium" style={{ color: 'var(--graphite-500)' }}>
            {format(TODAY, 'EEEE, d MMMM')}
            {streak >= 2 && ` · ${streak}d streak`}
          </p>
        </div>

        {/* Pre-plan banner */}
        {planNotStarted && (
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--mist)', borderRadius: 10 }}>
            <p className="text-[13px] leading-relaxed font-medium" style={{ color: 'var(--graphite-500)' }}>
              {prePlanMessage
                ? prePlanMessage
                : `Your plan starts on ${planStartDate
                    ? new Date(planStartDate + 'T12:00:00').toLocaleDateString('en-AU', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })
                    : 'soon'}.`}
            </p>
          </div>
        )}

        {/* Today's sessions */}
        <div>
          <p className="mb-3" style={sectionLabel}>Today</p>
          {hasSessions ? (
            <div className="space-y-2">
              {todaySessions.map(session => (
                <TodaySession key={session.id} session={session} weekSessions={weekSessions} />
              ))}
            </div>
          ) : !planNotStarted ? (
            <p className="text-[14px] font-medium" style={{ color: 'var(--graphite-500)' }}>Rest day — nothing scheduled.</p>
          ) : null}
        </div>

        {/* This week */}
        <div>
          <p className="mb-3" style={sectionLabel}>This week</p>
          <WeekStrip sessions={weekSessions} today={TODAY} />
        </div>

      </div>
    </div>
  )
}
