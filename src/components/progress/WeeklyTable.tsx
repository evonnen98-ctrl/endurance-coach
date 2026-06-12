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
        <div key={row.weekNum} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-semibold text-sm">W{row.weekNum}</span>
            <span className="text-xs text-gray-400">{row.weekStart}</span>
          </div>
          <div className="flex gap-4 text-xs">
            <div>
              <span className="text-blue-500 font-semibold uppercase tracking-widest text-[10px]">Swim</span>
              <div className="font-medium text-sm">{row.swim.toFixed(1)} km</div>
            </div>
            <div>
              <span className="text-orange-500 font-semibold uppercase tracking-widest text-[10px]">Ride</span>
              <div className="font-medium text-sm">{row.ride.toFixed(0)} km</div>
            </div>
            <div>
              <span className="text-green-500 font-semibold uppercase tracking-widest text-[10px]">Run</span>
              <div className="font-medium text-sm">{row.run.toFixed(1)} km</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
