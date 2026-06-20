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
      const paceSec = parsePaceToSec(paceStr)
      if (paceSec && (!pbs.run || paceSec < parsePaceToSec(pbs.run.pace)!)) {
        pbs.run = { pace: `${formatPace(paceSec)}/km`, distance_km: distKm ?? 0, date }
      }
      if (distKm && (!pbs.longestRun || distKm > pbs.longestRun.distance_km)) {
        pbs.longestRun = { distance_km: distKm, date }
      }
    }
    if (disc === 'ride') {
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

const sectionLabel: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--graphite-300)',
}

const pbLabelStyle: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--graphite-300)',
}

const pbValueStyle: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 900,
  fontSize: 26,
  lineHeight: 1,
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4" style={{ borderBottom: '1px solid var(--mist)' }}>
        <div className="flex items-center justify-between">
          <h1 style={{
            fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 800,
            fontSize: 28, letterSpacing: '-0.01em', lineHeight: 0.9,
            textTransform: 'uppercase', color: 'var(--ink)',
          }}>
            Progress
          </h1>
          {/* Distance / Time toggle — volt = active signal */}
          <div className="flex rounded-full p-1 gap-1" style={{ backgroundColor: 'var(--mist)' }}>
            <button
              onClick={() => setMode('distance')}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                borderRadius: 999,
                backgroundColor: mode === 'distance' ? 'var(--volt)' : 'transparent',
                color: mode === 'distance' ? 'var(--ink)' : 'var(--graphite-500)',
                fontFamily: '"Poppins", sans-serif',
              }}
            >
              Distance
            </button>
            <button
              onClick={() => setMode('time')}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                borderRadius: 999,
                backgroundColor: mode === 'time' ? 'var(--volt)' : 'transparent',
                color: mode === 'time' ? 'var(--ink)' : 'var(--graphite-500)',
                fontFamily: '"Poppins", sans-serif',
              }}
            >
              Time
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-6 pb-6">
        {/* Trend */}
        {trend && (
          <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'var(--mist)', borderRadius: 10 }}>
            <div className="text-xl">{trend.direction === 'up' ? '↑' : '↓'}</div>
            <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
              Run volume{' '}
              <span className="font-semibold">{trend.direction === 'up' ? '↑' : '↓'} {trend.pct}%</span>{' '}
              over the last {trend.weeks} weeks
            </p>
          </div>
        )}

        {/* Weekly volume */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--graphite-300)' }}>
          <div className="px-4 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--mist)' }}>
            <span style={sectionLabel}>Weekly volume</span>
            <div className="flex gap-3">
              {(['SWIM', 'RIDE', 'RUN'] as const).map(d => (
                <span key={d} style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700, fontSize: 8, letterSpacing: '0.12em', color: 'var(--graphite-300)', textTransform: 'uppercase' }}>
                  {d}
                </span>
              ))}
            </div>
          </div>
          <div className="px-4 py-3">
            <VolumeChart sessions={sessions} mode={mode} />
          </div>
        </div>

        {/* By the numbers */}
        <div>
          <p className="mb-3" style={sectionLabel}>By the numbers</p>
          <WeeklyTable sessions={sessions} />
        </div>

        {/* Personal bests */}
        <div>
          <p className="mb-3" style={sectionLabel}>Personal bests</p>
          {!hasPBs ? (
            <div className="rounded-xl py-12 flex flex-col items-center justify-center" style={{ border: '1px solid var(--graphite-300)' }}>
              <p style={{
                fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 900,
                fontSize: 72, lineHeight: 0.9, letterSpacing: '-0.02em', color: 'var(--volt)',
              }}>0</p>
              <p style={{ ...sectionLabel, marginTop: 10 }}>Personal bests</p>
              <p className="text-sm font-medium mt-2" style={{ color: 'var(--graphite-500)' }}>Complete sessions to start tracking</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pbs.run && (
                <PBCard label="Fastest run pace" value={pbs.run.pace} date={pbs.run.date} disc="RUN" />
              )}
              {pbs.longestRun && (
                <PBCard label="Longest run" value={`${pbs.longestRun.distance_km.toFixed(1)}km`} date={pbs.longestRun.date} disc="RUN" />
              )}
              {pbs.ride && (
                <PBCard label="Fastest ride pace" value={pbs.ride.pace} date={pbs.ride.date} disc="RIDE" />
              )}
              {pbs.longestRide && (
                <PBCard label="Longest ride" value={`${pbs.longestRide.distance_km.toFixed(0)}km`} date={pbs.longestRide.date} disc="RIDE" />
              )}
              {pbs.swim && (
                <PBCard label="Fastest swim pace" value={pbs.swim.pace} date={pbs.swim.date} disc="SWIM" />
              )}
              {pbs.longestSwim && (
                <PBCard label="Longest swim" value={`${(pbs.longestSwim.distance_km * 1000).toFixed(0)}m`} date={pbs.longestSwim.date} disc="SWIM" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PBCard({ label, value, date, disc }: { label: string; value: string; date: string; disc: string }) {
  return (
    <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between" style={{ border: '1px solid var(--graphite-300)' }}>
      <div className="flex items-center gap-3">
        <span style={{
          fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700,
          fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--graphite-300)', width: 28, flexShrink: 0,
        }}>
          {disc}
        </span>
        <div>
          <p style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700, fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--graphite-300)', marginBottom: 2 }}>
            {label}
          </p>
          <p style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 900, fontSize: 24, lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            {value}
          </p>
        </div>
      </div>
      <p className="text-xs font-medium" style={{ color: 'var(--graphite-300)' }}>{date}</p>
    </div>
  )
}
