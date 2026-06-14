import { useState, useEffect } from 'react'
import { format, differenceInDays, parseISO, subDays } from 'date-fns'
import { Settings, X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { User, Session, Checkin, CoachNote, Goal } from '../types'
import TodaySession from '../components/today/TodaySession'
import WeekStrip from '../components/today/WeekStrip'
import LatestCoachNote from '../components/today/LatestCoachNote'
import InlineDailyCheckIn from '../components/today/InlineDailyCheckIn'
import ProfileDrawer from '../components/profile/ProfileDrawer'

const TODAY = new Date()
const TODAY_STR = format(TODAY, 'yyyy-MM-dd')
const YESTERDAY_STR = format(subDays(TODAY, 1), 'yyyy-MM-dd')

export default function TodayPage() {
  const queryClient = useQueryClient()
  const [showProfile, setShowProfile] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

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
        .from('goals')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      return data as Goal | null
    },
  })

  const { data: todaySession } = useQuery({
    queryKey: ['today-session', TODAY_STR],
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .eq('scheduled_date', TODAY_STR)
        .order('day_of_week')
        .limit(1)
        .single()
      return data as Session | null
    },
  })

  const { data: weekSessions = [] } = useQuery({
    queryKey: ['week-sessions', TODAY_STR],
    queryFn: async () => {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const offset = (dayOfWeek + 6) % 7
      const mon = new Date(now)
      mon.setDate(now.getDate() - offset)
      const sun = new Date(mon)
      sun.setDate(mon.getDate() + 6)
      const monday = format(mon, 'yyyy-MM-dd')
      const sunday = format(sun, 'yyyy-MM-dd')
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .gte('scheduled_date', monday)
        .lte('scheduled_date', sunday)
        .order('day_of_week')
      return (data ?? []) as Session[]
    },
  })

  const { data: todayCheckin } = useQuery({
    queryKey: ['today-checkin', TODAY_STR],
    queryFn: async () => {
      const { data } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .eq('checkin_date', TODAY_STR)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as Checkin | null
    },
  })

  const { data: lastCheckin } = useQuery({
    queryKey: ['last-checkin'],
    queryFn: async () => {
      const { data } = await supabase
        .from('checkins')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('checkin_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as Checkin | null
    },
  })

  const { data: latestNote } = useQuery({
    queryKey: ['latest-coach-note'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coach_notes')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('week_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as CoachNote | null
    },
  })

  // Mark yesterday's planned sessions as missed
  useEffect(() => {
    async function markMissed() {
      const { data: yesterdayPlanned } = await supabase
        .from('sessions')
        .select('id')
        .eq('user_id', DEMO_USER_ID)
        .eq('scheduled_date', YESTERDAY_STR)
        .eq('status', 'planned')
      if (yesterdayPlanned?.length) {
        const ids = yesterdayPlanned.map(s => s.id)
        await supabase.from('sessions').update({ status: 'missed' }).in('id', ids)
        await queryClient.invalidateQueries({ queryKey: ['week-sessions'] })
      }
    }
    markMissed()
  }, [])

  const hasCheckedInToday = !!todayCheckin

  // Days since last check-in (not counting today)
  const daysSinceCheckin = lastCheckin && !hasCheckedInToday
    ? differenceInDays(TODAY, parseISO(lastCheckin.checkin_date))
    : 0

  const showNudge = !hasCheckedInToday && daysSinceCheckin >= 3

  // Race countdown
  const daysUntilRace = goal?.target_date
    ? differenceInDays(parseISO(goal.target_date), TODAY)
    : null

  const raceCountdownColor = daysUntilRace === null
    ? ''
    : daysUntilRace > 60
    ? 'text-green-600'
    : daysUntilRace > 30
    ? 'text-amber-500'
    : 'text-red-500'

  // Plan adjustment banner from user preferences
  const adjustmentBanner = !bannerDismissed
    ? ((user?.preferences as Record<string, unknown>)?.plan_adjustment_banner as string | undefined)
    : undefined

  const dayName = format(TODAY, 'EEEE d MMMM').toUpperCase()
  const phaseEmoji = user?.training_phase === 'race' ? '🎯' : user?.training_phase === 'build' ? '📈' : '💪'

  // Goal passed?
  const goalPassed = daysUntilRace !== null && daysUntilRace < 0

  async function dismissBanner() {
    setBannerDismissed(true)
    const prefs = (user?.preferences as Record<string, unknown>) ?? {}
    const { plan_adjustment_banner: _removed, ...rest } = prefs
    await supabase.from('users').update({ preferences: rest }).eq('id', DEMO_USER_ID)
    await queryClient.invalidateQueries({ queryKey: ['user'] })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">{dayName}</div>
            <h1 className="text-3xl font-bold">Morning, {user?.name ?? 'Coach'}.</h1>
            {goal && !goalPassed && (
              <p className="text-sm text-gray-500 mt-1">
                {phaseEmoji} {goal.event_type}
                {daysUntilRace !== null && (
                  <span className={`ml-2 font-semibold ${raceCountdownColor}`}>
                    · {daysUntilRace}d to go
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 rounded-full hover:bg-gray-100 mt-1"
          >
            <Settings size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      <div className="space-y-4 pt-4 pb-6">
        {/* Plan adjustment banner (#4) */}
        {adjustmentBanner && (
          <div className="mx-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-500 mt-0.5">⚡</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Your coach updated your plan</p>
              <p className="text-sm text-amber-700 mt-0.5">{adjustmentBanner}</p>
            </div>
            <button onClick={dismissBanner} className="text-amber-400 hover:text-amber-600">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Post-race framing (#14) */}
        {goalPassed && (
          <div className="mx-4 bg-green-50 border border-green-100 rounded-2xl p-4">
            <p className="font-semibold text-green-800 text-sm">Race complete 🏁</p>
            <p className="text-sm text-green-700 mt-1">
              Your {goal?.event_type} date has passed. This week is about recovery — easy sessions only.
              Ready to set your next goal?
            </p>
          </div>
        )}

        {/* Hero check-in (#5) — shown above everything when no check-in today */}
        {!hasCheckedInToday && !showNudge && (
          <InlineDailyCheckIn
            name={user?.name ?? 'there'}
            todaySession={todaySession ?? undefined}
          />
        )}

        {/* Nudge for 3+ day gap (#5) */}
        {showNudge && (
          <InlineDailyCheckIn
            name={user?.name ?? 'there'}
            todaySession={todaySession ?? undefined}
            nudgeOnly
          />
        )}

        {/* Checked-in indicator + today's session (#5) */}
        {hasCheckedInToday && todaySession && (
          <div className="mx-4 flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px]">✓</span>
            Checked in today
          </div>
        )}

        {/* Today's session */}
        {todaySession ? (
          <TodaySession
            session={todaySession}
            checkin={todayCheckin ?? undefined}
            weekSessions={weekSessions}
          />
        ) : hasCheckedInToday ? (
          <div className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-gray-400 text-sm">No session scheduled today — rest up.</p>
          </div>
        ) : null}

        {/* Race countdown card (#10) */}
        {daysUntilRace !== null && daysUntilRace >= 0 && goal?.event_type && (
          <div className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🏁</span>
            <div>
              <p className={`text-lg font-bold ${raceCountdownColor}`}>{daysUntilRace} days</p>
              <p className="text-xs text-gray-500">until your {goal.event_type}</p>
            </div>
          </div>
        )}

        {/* Week strip */}
        <WeekStrip sessions={weekSessions} today={TODAY} />

        {/* Coach notes */}
        {latestNote && <LatestCoachNote note={latestNote} />}
      </div>

      {showProfile && user && (
        <ProfileDrawer user={user} onClose={() => setShowProfile(false)} />
      )}
    </div>
  )
}
