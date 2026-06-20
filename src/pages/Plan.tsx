import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Flag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { Session, Goal } from '../types'
import WeekSection from '../components/plan/WeekSection'

const toggleBtnBase: React.CSSProperties = {
  fontFamily: '"Poppins", sans-serif',
  fontWeight: 600,
  fontSize: 13,
  borderRadius: 999,
}

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
  const raceSession  = sessions.find(s => s.session_type === 'race')
  const planSessions = sessions.filter(s => s.session_type !== 'race')

  const weekGroups = planSessions.reduce<Record<number, Session[]>>((acc, s) => {
    acc[s.week_number] = acc[s.week_number] ?? []
    acc[s.week_number].push(s)
    return acc
  }, {})

  const sortedWeeks = Object.keys(weekGroups).map(Number).sort((a, b) => a - b)

  const raceDate = goal?.target_date
    ? new Date(goal.target_date + 'T12:00:00')
    : raceSession?.scheduled_date
    ? parseISO(raceSession.scheduled_date)
    : null

  const raceDateStr = raceDate
    ? raceDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4" style={{ borderBottom: '1px solid var(--mist)' }}>
        <h1 style={{
          fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 800,
          fontSize: 28, letterSpacing: '-0.01em', lineHeight: 0.9,
          textTransform: 'uppercase', color: 'var(--ink)',
        }}>
          Training plan
        </h1>
        {hasModified && (
          <div className="flex mt-3 rounded-full p-1 w-fit gap-1" style={{ backgroundColor: 'var(--mist)' }}>
            <button
              onClick={() => setShowOriginal(false)}
              className="px-4 py-1.5 transition-colors"
              style={{ ...toggleBtnBase, backgroundColor: !showOriginal ? '#FFFFFF' : 'transparent', color: !showOriginal ? 'var(--ink)' : 'var(--graphite-500)' }}
            >
              Current
            </button>
            <button
              onClick={() => setShowOriginal(true)}
              className="px-4 py-1.5 transition-colors"
              style={{ ...toggleBtnBase, backgroundColor: showOriginal ? '#FFFFFF' : 'transparent', color: showOriginal ? 'var(--ink)' : 'var(--graphite-500)' }}
            >
              Original
            </button>
          </div>
        )}
      </div>

      <div className="px-5 pt-5 space-y-5 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--graphite-300)', borderTopColor: 'transparent' }} />
          </div>
        ) : sortedWeeks.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--graphite-500)' }}>
            <p className="text-sm font-medium">No plan yet. Complete onboarding to generate your plan.</p>
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

            {/* Race day banner */}
            {(raceSession || (goal?.target_date && goal?.event_type)) && (
              <div className="mt-2 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--ink)' }}>
                <div className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Flag size={20} style={{ color: 'var(--volt)', flexShrink: 0 }} />
                    <div className="flex-1">
                      <p style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#FFFFFF' }}>
                        Race Day — {goal?.event_type ?? raceSession?.description?.split('—')[0]?.trim() ?? 'Race Day'}
                      </p>
                      {raceDateStr && (
                        <p className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--graphite-500)' }}>{raceDateStr}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-[13px] mt-3 leading-relaxed font-medium" style={{ color: 'var(--graphite-300)' }}>
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
