import { format, startOfWeek, parseISO } from 'date-fns'
import type { Session } from '../../types'

interface Props {
  sessions: Session[]
}

interface WeekRow {
  weekNum: number
  weekStart: string
  swim: number
  ride: number
  run: number
}

function buildRows(sessions: Session[]): WeekRow[] {
  const map = new Map<number, WeekRow>()

  sessions.filter(s => s.status === 'complete').forEach(s => {
    const wn = s.week_number
    if (!map.has(wn)) {
      const wStart = format(startOfWeek(parseISO(s.scheduled_date), { weekStartsOn: 1 }), 'MMM d')
      map.set(wn, { weekNum: wn, weekStart: wStart, swim: 0, ride: 0, run: 0 })
    }
    const row = map.get(wn)!
    if (s.discipline === 'swim') row.swim += s.distance_km ?? 0
    if (s.discipline === 'ride') row.ride += s.distance_km ?? 0
    if (s.discipline === 'run') row.run += s.distance_km ?? 0
    if (s.discipline === 'brick') {
      row.ride += (s.distance_km ?? 0) * 0.6
      row.run += (s.distance_km ?? 0) * 0.4
    }
  })

  return Array.from(map.values()).sort((a, b) => b.weekNum - a.weekNum)
}

export default function WeeklyTable({ sessions }: Props) {
  const rows = buildRows(sessions)

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No completed sessions yet.</p>
  }

  return (
    <div className="space-y-2">
      {rows.map(row => (
        <div key={row.weekNum} className="bg-white rounded-xl px-4 py-3" style={{ border: '1px solid var(--graphite-300)' }}>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>W{row.weekNum}</span>
            <span className="text-xs font-medium" style={{ color: 'var(--graphite-300)' }}>{row.weekStart}</span>
          </div>
          <div className="flex gap-4 text-xs">
            <div>
              <span style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700, fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--graphite-300)' } as React.CSSProperties}>Swim</span>
              <div className="font-semibold text-sm mt-0.5" style={{ color: 'var(--ink)' }}>{row.swim.toFixed(1)} km</div>
            </div>
            <div>
              <span style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700, fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--graphite-300)' } as React.CSSProperties}>Ride</span>
              <div className="font-semibold text-sm mt-0.5" style={{ color: 'var(--ink)' }}>{row.ride.toFixed(0)} km</div>
            </div>
            <div>
              <span style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 700, fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--graphite-300)' } as React.CSSProperties}>Run</span>
              <div className="font-semibold text-sm mt-0.5" style={{ color: 'var(--ink)' }}>{row.run.toFixed(1)} km</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
