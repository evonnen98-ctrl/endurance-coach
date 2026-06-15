import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { WorkoutLog, Session } from '../types'
import WorkoutHistoryEntry from '../components/notes/WorkoutHistoryEntry'

export default function HistoryPage() {
  const { data: workoutLogs = [] } = useQuery({
    queryKey: ['workout-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('logged_at', { ascending: false })
        .limit(60)
      return (data ?? []) as WorkoutLog[]
    },
  })

  const { data: sessions = [] } = useQuery({
    queryKey: ['all-sessions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
      return (data ?? []) as Session[]
    },
  })

  const sessionById = Object.fromEntries(sessions.map(s => [s.id, s]))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-6 pt-14 pb-5">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">All sessions</div>
        <h1 className="text-2xl font-semibold">History</h1>
      </div>

      <div className="px-6 pt-6 pb-6">
        {workoutLogs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            No workouts logged yet. Complete a session to see your history here.
          </div>
        ) : (
          <div className="space-y-2">
            {workoutLogs.map(log => (
              <WorkoutHistoryEntry
                key={log.id}
                log={log}
                session={log.session_id ? sessionById[log.session_id] : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
