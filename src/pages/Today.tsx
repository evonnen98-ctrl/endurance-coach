import { useState } from 'react'
import { format } from 'date-fns'
import { Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { User, Session, Checkin, CoachNote, Goal, TrainingPlan } from '../types'
import TodaySession from '../components/today/TodaySession'
import WeekStrip from '../components/today/WeekStrip'
import LatestCoachNote from '../components/today/LatestCoachNote'
import CheckInModal from '../components/modals/CheckInModal'
import ProfileDrawer from '../components/profile/ProfileDrawer'

const TODAY = new Date()
const TODAY_STR = format(TODAY, 'yyyy-MM-dd')

export default function TodayPage() {
  const [showCheckin, setShowCheckin] = useState(false)
  const [showProfile, setShowProfile] = useState(false)

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
      const offset = (dayOfWeek + 6) % 7 // days since Monday
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

  const todayDate = new Date()
  const dayName = format(todayDate, 'EEEE d MMMM').toUpperCase()
  const phaseEmoji = user?.training_phase === 'race' ? '🎯' : user?.training_phase === 'build' ? '📈' : '💪'

  const hasCheckedInToday = !!todayCheckin

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">{dayName}</div>
            <h1 className="text-3xl font-bold">Morning, {user?.name ?? 'Coach'}.</h1>
            {goal && (
              <p className="text-sm text-gray-500 mt-1">
                {phaseEmoji} Training for a race &middot; {goal.event_type}
              </p>
            )}
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setShowProfile(true)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              <Settings size={18} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 pt-5 pb-6">
        {/* Today's session */}
        {todaySession ? (
          <TodaySession session={todaySession} checkin={todayCheckin ?? undefined} />
        ) : (
          <div className="mx-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-gray-400 text-sm">No session scheduled for today.</p>
          </div>
        )}

        {/* Week strip */}
        <WeekStrip sessions={weekSessions} today={new Date()} />

        {/* Coach notes */}
        {latestNote && <LatestCoachNote note={latestNote} />}
      </div>

      {/* Check-in FAB */}
      {!hasCheckedInToday && (
        <button
          onClick={() => setShowCheckin(true)}
          className="fixed bottom-24 right-4 bg-black text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold z-30"
        >
          <span className="text-base">👋</span>
          Check in
        </button>
      )}

      {showCheckin && (
        <CheckInModal
          todaySession={todaySession ?? undefined}
          onClose={() => setShowCheckin(false)}
        />
      )}

      {showProfile && user && (
        <ProfileDrawer user={user} onClose={() => setShowProfile(false)} />
      )}
    </div>
  )
}
