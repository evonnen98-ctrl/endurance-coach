import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { Session, WorkoutLog } from '../types'
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
  const older  = completedByWeek[weeks[0]]
  if (!older) return null

  const pct = Math.round(((recent - older) / older) * 100)
  if (Math.abs(pct) < 2) return null

  return { direction: pct > 0 ? 'up' : 'down', pct: Math.abs(pct), weeks: weeks.length }
}

// Parse "mm:ss/km" or "mm:ss/100m" → total seconds (lower = faster)
function parsePaceToSec(pace: string | undefined | null): number | null {
  if (!pace) return null
  const match = pace.match(/(\d+):(\d+)/)
  if (!match) return null
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

function formatPace(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

interface PBs {
  run?:  { pace: string; distance_km: number; date: string }
  ride?: { pace: string; distance_km: number; date: string }
  swim?: { pace: string; distance_km: number; date: string }
  longestRun?:  { distance_km: number; date: string }
  longestRide?: { distance_km: number; date: string }
  longestSwim?: { distance_km: number; date: string }
}

function computePBs(logs: WorkoutLog[], sessions: Session[]): PBs {
  const pbs: PBs = {}
  const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]))

  for (const log of logs) {
    const session = log.session_id ? sessionMap[log.session_id] : null
    const disc = session?.discipline ?? 'run'
    const distKm = log.actual_distance_km
    const paceStr = log.actual_pace || log.average_pace_per_km
    const date = log.logged_at?.split('T')[0] ?? ''

    if (disc === 'run') {
      // Fastest pace
      const paceSec = parsePaceToSec(paceStr)
      if (paceSec && (!pbs.run || paceSec < parsePaceToSec(pbs.run.pace)!)) {
        pbs.run = { pace: `${formatPace(paceSec)}/km`, distance_km: distKm ?? 0, date }
      }
      // Longest
      if (distKm && (!pbs.longestRun || distKm > pbs.longestRun.distance_km)) {
        pbs.longestRun = { distance_km: distKm, date }
      }
    }
    if (disc === 'ride') {
      // Fastest speed (stored as km/h string, or pace)
      const paceSec = parsePaceToSec(paceStr)
      if (paceSec && (!pbs.ride || paceSec < parsePaceToSec(pbs.ride.pace)!)) {
        pbs.ride = { pace: `${formatPace(paceSec)}/km`, distance_km: distKm ?? 0, date }
      }
      if (distKm && (!pbs.longestRide || distKm > pbs.longestRide.distance_km)) {
        pbs.longestRide = { distance_km: distKm, date }
      }
    }
    if (disc === 'swim') {
      const paceSec = parsePaceToSec(paceStr)
      if (paceSec && (!pbs.swim || paceSec < parsePaceToSec(pbs.swim.pace)!)) {
        pbs.swim = { pace: `${formatPace(paceSec)}/100m`, distance_km: distKm ?? 0, date }
      }
      if (distKm && (!pbs.longestSwim || distKm > pbs.longestSwim.distance_km)) {
        pbs.longestSwim = { distance_km: distKm, date }
      }
    }
  }

  return pbs
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

  const { data: workoutLogs = [] } = useQuery({
    queryKey: ['workout-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('logged_at', { ascending: false })
      return (data ?? []) as WorkoutLog[]
    },
  })

  const trend = trendLabel(sessions)
  const pbs   = computePBs(workoutLogs, sessions)

  const hasPBs = pbs.run || pbs.ride || pbs.swim || pbs.longestRun || pbs.longestRide || pbs.longestSwim

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

        <div>
          <h2 className="font-semibold text-base mb-3">By the numbers</h2>
          <WeeklyTable sessions={sessions} />
        </div>

        {/* Personal Bests (#11) */}
        <div>
          <h2 className="font-semibold text-base mb-3">Personal bests</h2>
          {!hasPBs ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-gray-400 text-sm">Complete sessions to start tracking your personal bests.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pbs.run && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm">🏃</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Fastest run pace</p>
                      <p className="font-bold text-lg">{pbs.run.pace}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{pbs.run.date}</p>
                </div>
              )}
              {pbs.longestRun && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-sm">📏</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Longest run</p>
                      <p className="font-bold text-lg">{pbs.longestRun.distance_km.toFixed(1)}km</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{pbs.longestRun.date}</p>
                </div>
              )}
              {pbs.ride && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm">🚴</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Fastest ride pace</p>
                      <p className="font-bold text-lg">{pbs.ride.pace}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{pbs.ride.date}</p>
                </div>
              )}
              {pbs.longestRide && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-sm">📏</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Longest ride</p>
                      <p className="font-bold text-lg">{pbs.longestRide.distance_km.toFixed(1)}km</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{pbs.longestRide.date}</p>
                </div>
              )}
              {pbs.swim && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">🏊</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Fastest swim pace</p>
                      <p className="font-bold text-lg">{pbs.swim.pace}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{pbs.swim.date}</p>
                </div>
              )}
              {pbs.longestSwim && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">📏</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Longest swim</p>
                      <p className="font-bold text-lg">{(pbs.longestSwim.distance_km * 1000).toFixed(0)}m</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">{pbs.longestSwim.date}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
