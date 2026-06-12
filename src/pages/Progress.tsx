import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { Session } from '../types'
import VolumeChart from '../components/progress/VolumeChart'
import WeeklyTable from '../components/progress/WeeklyTable'

function trendLabel(sessions: Session[]) {
  const completedByWeek = sessions
    .filter(s => s.status === 'complete' && s.discipline === 'run')
    .reduce<Record<number, number>>((acc, s) => {
      acc[s.week_number] = (acc[s.week_number] ?? 0) + (s.distance_km ?? 0)
      return acc
    }, {})

  const weeks = Object.keys(completedByWeek).map(Number).sort((a, b) => a - b)
  if (weeks.length < 2) return null

  const recent = completedByWeek[weeks[weeks.length - 1]]
  const older = completedByWeek[weeks[0]]
  if (!older) return null

  const pct = Math.round(((recent - older) / older) * 100)
  if (Math.abs(pct) < 2) return null

  return {
    direction: pct > 0 ? 'up' : 'down',
    pct: Math.abs(pct),
    weeks: weeks.length,
  }
}

export default function ProgressPage() {
  const [mode, setMode] = useState<'distance' | 'time'>('distance')

  const { data: sessions = [] } = useQuery({
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

  const trend = trendLabel(sessions)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-12 pb-5">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Volume & Consistency</div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Progress</h1>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button
              onClick={() => setMode('distance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'distance' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
            >
              Distance
            </button>
            <button
              onClick={() => setMode('time')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === 'time' ? 'bg-white shadow-sm text-black' : 'text-gray-500'}`}
            >
              Time
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-5 pb-6">
        {/* Trend pill */}
        {trend && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className="text-xl">{trend.direction === 'up' ? '📈' : '📉'}</span>
            <p className="text-sm text-gray-700">
              Run volume{' '}
              <span className={trend.direction === 'up' ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                {trend.direction} {trend.pct}%
              </span>{' '}
              over the last {trend.weeks} weeks
            </p>
          </div>
        )}

        {/* Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-sm">Weekly volume</span>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Swim</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />Ride</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Run</span>
            </div>
          </div>
          <VolumeChart sessions={sessions} mode={mode} />
        </div>

        {/* By the numbers */}
        <div>
          <h2 className="font-semibold text-base mb-3">By the numbers</h2>
          <WeeklyTable sessions={sessions} />
        </div>
      </div>
    </div>
  )
}
