import { useEffect, useMemo } from 'react'
import { format, differenceInDays, parseISO, subDays, addDays } from 'date-fns'
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
  if (h >= 22 || h < 5) return `Late night${n} 🌙`
  if (h < 12)           return `Good morning${n} 👋`
  if (h < 17)           return `Good afternoon${n} ☀️`
  return `Good evening${n} 🌙`
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

  const countdownColor = daysUntilRace === null ? '#3B82F6'
    : daysUntilRace > 60 ? '#3B82F6'
    : daysUntilRace > 30 ? '#F59E0B'
    : '#EF4444'

  const countdownBg = daysUntilRace === null ? 'rgba(59,130,246,0.07)'
    : daysUntilRace > 60 ? 'rgba(59,130,246,0.07)'
    : daysUntilRace > 30 ? 'rgba(245,158,11,0.07)'
    : 'rgba(239,68,68,0.07)'

  const hasSessions = todaySessions.length > 0 && !todaySessions.every(s => s.discipline === 'rest')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Greeting */}
      <div className="px-5 pt-14">
        <h1
          className="animate-fade-in"
          style={{ fontSize: 22, fontWeight: 500, color: '#1a1a1a', lineHeight: 1.2 }}
        >
          {getGreeting(user?.name)}
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-[13px] text-gray-400">{format(TODAY, 'EEEE, d MMMM')}</p>
          {streak >= 2 && (
            <span className="text-[13px] font-semibold" style={{ color: '#F97316' }}>
              🔥 {streak} day streak
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-5 pb-24 space-y-5">

        {/* Race countdown */}
        {goal?.event_type && daysUntilRace !== null && (
          <div
            className="rounded-lg py-5 text-center"
            style={{ backgroundColor: countdownBg, border: `1px solid ${countdownColor}22` }}
          >
            <p
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 80,
                lineHeight: 1,
                color: countdownColor,
              }}
            >
              {Math.abs(daysUntilRace)}
            </p>
            <p className="text-[13px] text-gray-400 mt-1.5">
              {daysUntilRace < 0 ? 'days since' : 'days until'}
            </p>
            <p className="text-[15px] font-semibold mt-1" style={{ color: countdownColor }}>
              {goal.event_type} 🏁
            </p>

            {/* Plan progress bar */}
            {planProgressPct !== null && activePlanWeeks && planCurrentWeek && (
              <div className="px-6 mt-4">
                <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${countdownColor}25` }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${planProgressPct}%`, backgroundColor: countdownColor }}
                  />
                </div>
                <p className="text-right text-[11px] mt-1" style={{ color: `${countdownColor}99` }}>
                  Week {planCurrentWeek} of {activePlanWeeks}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pre-plan banner */}
        {planNotStarted && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-[13px] text-amber-700 leading-relaxed">
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Today</p>
          {hasSessions ? (
            <div className="space-y-2">
              {todaySessions.map(session => (
                <TodaySession key={session.id} session={session} weekSessions={weekSessions} />
              ))}
            </div>
          ) : !planNotStarted ? (
            <p className="text-[14px] text-gray-400">Rest day — nothing scheduled.</p>
          ) : null}
        </div>

        {/* This week */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">This week</p>
          <WeekStrip sessions={weekSessions} today={TODAY} />
        </div>

      </div>
    </div>
  )
}
