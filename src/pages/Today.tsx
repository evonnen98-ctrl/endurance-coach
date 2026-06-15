import { useEffect } from 'react'
import { format, differenceInDays, parseISO, subDays, addDays } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { User, Session, Goal } from '../types'
import TodaySession from '../components/today/TodaySession'
import WeekStrip from '../components/today/WeekStrip'

const TODAY      = new Date()
const TODAY_STR  = format(TODAY, 'yyyy-MM-dd')
const YESTERDAY  = format(subDays(TODAY, 1), 'yyyy-MM-dd')

function getGreeting(name?: string): string {
  const h = TODAY.getHours()
  const n = name ? `, ${name}` : ''
  if (h >= 22 || h < 5) return `Late night${n} 🌙`
  if (h < 12)           return `Good morning${n} 👋`
  if (h < 17)           return `Good afternoon${n} ☀️`
  return `Good evening${n} 🌙`
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

  const activePlanId      = activePlan?.id ?? null
  const planStartDate     = activePlan?.start_date as string | undefined
  const activePlanWeeks   = (activePlan?.total_weeks ?? null) as number | null
  const prefs             = (user?.preferences ?? {}) as Record<string, unknown>
  const prePlanMessage    = prefs.pre_plan_message as string | undefined
  const planPhaseLabel    = prefs.plan_phase_label as string | undefined
  const baseEndWeek       = Number(prefs.plan_base_end_week  ?? 0)
  const buildEndWeek      = Number(prefs.plan_build_end_week ?? 0)
  const peakEndWeek       = Number(prefs.plan_peak_end_week  ?? 0)
  const planNotStarted    = planStartDate ? planStartDate > TODAY_STR : false

  const planCurrentWeek = planStartDate && !planNotStarted && activePlanWeeks
    ? Math.min(activePlanWeeks, Math.max(1, Math.ceil(differenceInDays(TODAY, parseISO(planStartDate)) / 7) + 1))
    : null

  const weekOfDate = planStartDate && planCurrentWeek
    ? format(addDays(parseISO(planStartDate), (planCurrentWeek - 1) * 7), 'd MMM')
    : null

  const currentBlockLabel = planCurrentWeek && (baseEndWeek || buildEndWeek || peakEndWeek)
    ? planCurrentWeek <= baseEndWeek  ? 'Base Block'
      : planCurrentWeek <= buildEndWeek ? 'Build Block'
      : planCurrentWeek <= peakEndWeek  ? 'Peak Block'
      : 'Taper'
    : planPhaseLabel ?? null

  const planTimeline = planCurrentWeek && activePlanWeeks
    ? [
        `Week ${planCurrentWeek} of ${activePlanWeeks}`,
        weekOfDate ? `w/c ${weekOfDate}` : null,
        currentBlockLabel,
      ].filter(Boolean).join(' · ')
    : null

  const { data: todaySession } = useQuery({
    queryKey: ['today-session', TODAY_STR, activePlanId],
    enabled: activePlanId != null,
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions').select('*').eq('plan_id', activePlanId!)
        .eq('scheduled_date', TODAY_STR).order('day_of_week').limit(1).maybeSingle()
      return (data ?? null) as Session | null
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

  // Mark yesterday's planned sessions as missed
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

  const dayLabel = format(TODAY, 'EEEE d MMMM').toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white px-6 pt-14 pb-5">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{dayLabel}</div>
        <h1 className="text-[20px] font-semibold text-[#374151] animate-fade-in">{getGreeting(user?.name)}</h1>
      </div>

      <div className="space-y-7 pt-4 pb-6">

        {/* Race countdown — bold visual card */}
        {goal?.event_type && daysUntilRace !== null && (
          <div
            className="mx-6 rounded-2xl overflow-hidden"
            style={{ backgroundColor: countdownBg, border: `1px solid ${countdownColor}22` }}
          >
            <div className="px-5 pt-5 pb-4 text-center">
              <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: countdownColor }}>
                {daysUntilRace < 0 ? 'Race passed' : 'Countdown'}
              </div>
              <p
                className="tabular-nums font-bold leading-none"
                style={{ fontSize: '76px', color: countdownColor, lineHeight: 1 }}
              >
                {Math.abs(daysUntilRace)}
              </p>
              <p className="text-[13px] text-gray-500 mt-2">
                {daysUntilRace < 0 ? 'days since' : 'days until'}
              </p>
              <p className="text-[17px] font-bold mt-1" style={{ color: countdownColor }}>
                {goal.event_type} 🏁
              </p>
              {goal.target_date && (
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(goal.target_date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Plan timeline */}
        {planTimeline && (
          <div className="mx-6 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">Training plan</div>
            <p className="text-[16px] font-semibold text-gray-900">{planTimeline}</p>
            {prePlanMessage && (
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{prePlanMessage}</p>
            )}
          </div>
        )}

        {/* Pre-plan banner — plan exists but hasn't started yet */}
        {planNotStarted && (
          <div className="mx-6 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5">
            <div className="text-xs font-medium uppercase tracking-wider text-amber-600 mb-1.5">Coming up</div>
            {prePlanMessage && <p className="text-[16px] text-amber-900 mb-1">{prePlanMessage}</p>}
            <p className="text-[16px] text-amber-800 font-medium">
              Your plan starts on {planStartDate ? new Date(planStartDate + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'soon'}.
            </p>
          </div>
        )}

        {/* Today's workout */}
        {todaySession ? (
          <TodaySession
            session={todaySession}
            weekSessions={weekSessions}
          />
        ) : planNotStarted ? (
          <div className="mx-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Today</p>
            <p className="text-[16px] text-gray-500 mt-1">Rest up — training starts soon.</p>
          </div>
        ) : (
          <div className="mx-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Today</p>
            <p className="text-[16px] text-gray-500 mt-1">Rest day — no session scheduled.</p>
          </div>
        )}

        {/* This week */}
        <WeekStrip sessions={weekSessions} today={TODAY} />
      </div>
    </div>
  )
}
