import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { Session, Goal } from '../types'
import WeekSection from '../components/plan/WeekSection'

export default function PlanPage() {
  const today = new Date()
  const [showOriginal, setShowOriginal] = useState(false)

  const { data: activePlan } = useQuery({
    queryKey: ['active-plan-id'],
    queryFn: async () => {
      const { data } = await supabase
        .from('training_plans').select('id, start_date, total_weeks').eq('user_id', DEMO_USER_ID).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      return data ?? null
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

  const activePlanId   = activePlan?.id ?? null
  const planStartDate  = activePlan?.start_date as string | undefined
  const totalPlanWeeks = (activePlan?.total_weeks ?? 0) as number

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['all-sessions', activePlanId],
    enabled: activePlanId != null,
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('plan_id', activePlanId!)
        .order('scheduled_date')
      return (data ?? []) as Session[]
    },
  })

  const hasModified = sessions.some(s => s.status === 'modified')

  // Separate the race day session — show it as a special banner, not inside a week
  const raceSession  = sessions.find(s => s.session_type === 'race')
  const planSessions = sessions.filter(s => s.session_type !== 'race')

  const weekGroups = planSessions.reduce<Record<number, Session[]>>((acc, s) => {
    acc[s.week_number] = acc[s.week_number] ?? []
    acc[s.week_number].push(s)
    return acc
  }, {})

  const sortedWeeks = Object.keys(weekGroups)
    .map(Number)
    .sort((a, b) => a - b)

  const raceDate = goal?.target_date
    ? new Date(goal.target_date + 'T12:00:00')
    : raceSession?.scheduled_date
    ? parseISO(raceSession.scheduled_date)
    : null

  const raceDateStr = raceDate
    ? raceDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-6 pt-14 pb-4">
        <h1 className="text-[22px] font-semibold" style={{ color: '#1C1917' }}>Training plan</h1>
        {hasModified && (
          <div className="flex mt-3 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setShowOriginal(false)}
              className={`px-4 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${!showOriginal ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}
            >
              Current plan
            </button>
            <button
              onClick={() => setShowOriginal(true)}
              className={`px-4 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${showOriginal ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}
            >
              Original plan
            </button>
          </div>
        )}
      </div>

      <div className="px-6 pt-6 space-y-6 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedWeeks.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No plan yet. Complete onboarding to generate your plan.
          </div>
        ) : (
          <>
            {sortedWeeks.map(week => (
              <WeekSection
                key={week}
                weekNumber={week}
                totalWeeks={totalPlanWeeks}
                sessions={weekGroups[week]}
                today={today}
                planStartDate={planStartDate}
                showOriginal={showOriginal}
              />
            ))}

            {/* Race day banner — after all weeks */}
            {(raceSession || (goal?.target_date && goal?.event_type)) && (
              <div className="mt-2 bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏁</span>
                    <div className="flex-1">
                      <p className="text-[15px] font-bold text-white">
                        Race Day · {goal?.event_type ?? raceSession?.description?.split('—')[0]?.trim() ?? 'Race Day'}
                      </p>
                      {raceDateStr && (
                        <p className="text-[13px] text-amber-100 mt-0.5">{raceDateStr}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-[13px] text-amber-100 mt-3 leading-relaxed">
                    {raceSession?.coaching_rationale ?? "You've done the work. Trust your preparation and race your plan."}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
