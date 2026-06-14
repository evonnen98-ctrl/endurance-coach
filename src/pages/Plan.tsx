import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { Session } from '../types'
import WeekSection from '../components/plan/WeekSection'

export default function PlanPage() {
  const today = new Date()

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['all-sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('scheduled_date')
      return (data ?? []) as Session[]
    },
  })

  const weekGroups = sessions.reduce<Record<number, Session[]>>((acc, s) => {
    acc[s.week_number] = acc[s.week_number] ?? []
    acc[s.week_number].push(s)
    return acc
  }, {})

  const sortedWeeks = Object.keys(weekGroups)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-14 pb-5">
        <h1 className="text-3xl font-bold">Training plan</h1>
      </div>

      <div className="px-4 pt-5 space-y-8 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedWeeks.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No plan yet. Complete onboarding to generate your plan.
          </div>
        ) : (
          sortedWeeks.map(week => (
            <WeekSection
              key={week}
              weekNumber={week}
              sessions={weekGroups[week]}
              today={today}
            />
          ))
        )}
      </div>
    </div>
  )
}
