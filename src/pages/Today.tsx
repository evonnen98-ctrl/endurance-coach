import { useEffect } from 'react'
import { format, differenceInDays, parseISO, subDays } from 'date-fns'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { User, Session, Goal } from '../types'
import TodaySession from '../components/today/TodaySession'
import WeekStrip from '../components/today/WeekStrip'

const TODAY      = new Date()
const TODAY_STR  = format(TODAY, 'yyyy-MM-dd')
const YESTERDAY  = format(subDays(TODAY, 1), 'yyyy-MM-dd')

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
        .from('training_plans').select('id, start_date, pre_plan_message').eq('user_id', DEMO_USER_ID).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      return data ?? null
    },
  })
  const activePlanId      = activePlan?.id ?? null
  const planStartDate     = activePlan?.start_date as string | undefined
  const prePlanMessage    = activePlan?.pre_plan_message as string | undefined
  const planNotStarted    = planStartDate ? planStartDate > TODAY_STR : false

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

  const countdownColor = daysUntilRace === null ? 'text-gray-700'
    : daysUntilRace > 60 ? 'text-green-600'
    : daysUntilRace > 30 ? 'text-amber-500'
    : 'text-red-500'

  const dayLabel = format(TODAY, 'EEEE d MMMM').toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white px-5 pt-14 pb-5">
        <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">{dayLabel}</div>
        <h1 className="text-3xl font-bold">Good morning{user?.name ? `, ${user.name}` : ''}.</h1>
      </div>

      <div className="space-y-4 pt-4 pb-6">

        {/* Race countdown — most prominent element */}
        {goal?.event_type && daysUntilRace !== null && (
          <div className="mx-5 bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
              {daysUntilRace < 0 ? 'Race passed' : 'Countdown'}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold tabular-nums ${countdownColor}`}>
                {Math.abs(daysUntilRace)}
              </span>
              <span className="text-lg font-medium text-gray-500">
                {daysUntilRace < 0 ? 'days since' : 'days until'}
              </span>
            </div>
            <p className="text-base font-semibold text-gray-800 mt-0.5">{goal.event_type}</p>
          </div>
        )}

        {/* Pre-plan message (race far away — plan starts in future) */}
        {planNotStarted && prePlanMessage && (
          <div className="mx-5 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-1">Coming up</div>
            <p className="text-sm text-amber-900">{prePlanMessage}</p>
          </div>
        )}

        {/* Today's workout */}
        {todaySession ? (
          <TodaySession
            session={todaySession}
            weekSessions={weekSessions}
          />
        ) : planNotStarted ? (
          <div className="mx-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-gray-400 text-sm">Your plan starts on {planStartDate ? new Date(planStartDate + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) : 'soon'}.</p>
          </div>
        ) : (
          <div className="mx-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-gray-400 text-sm">Rest day — no session scheduled.</p>
          </div>
        )}

        {/* This week */}
        <WeekStrip sessions={weekSessions} today={TODAY} />
      </div>
    </div>
  )
}
