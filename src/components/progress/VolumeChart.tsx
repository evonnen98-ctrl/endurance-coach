import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import type { Session } from '../../types'
import { startOfWeek, format, addDays, isSameWeek, parseISO } from 'date-fns'

interface Props {
  sessions: Session[]
  mode: 'distance' | 'time'
}

function buildChartData(sessions: Session[], mode: 'distance' | 'time') {
  const weekMap = new Map<string, { swim: number; ride: number; run: number; weekNum: number }>()

  sessions.forEach(s => {
    const date = parseISO(s.scheduled_date)
    const wStart = startOfWeek(date, { weekStartsOn: 1 })
    const key = format(wStart, 'MMM d')
    if (!weekMap.has(key)) weekMap.set(key, { swim: 0, ride: 0, run: 0, weekNum: s.week_number })
    const entry = weekMap.get(key)!

    if (s.status === 'complete') {
      const val = mode === 'distance'
        ? (s.distance_km ?? 0)
        : (s.duration_minutes ? s.duration_minutes / 60 : 0)

      if (s.discipline === 'swim') entry.swim += val
      if (s.discipline === 'ride') entry.ride += val
      if (s.discipline === 'run') entry.run += val
      if (s.discipline === 'brick') {
        entry.ride += val * 0.6
        entry.run += val * 0.4
      }
    }
  })

  return Array.from(weekMap.entries())
    .sort((a, b) => a[1].weekNum - b[1].weekNum)
    .map(([week, data]) => ({
      week: `W${data.weekNum}`,
      Swim: parseFloat(data.swim.toFixed(1)),
      Ride: parseFloat(data.ride.toFixed(1)),
      Run: parseFloat(data.run.toFixed(1)),
    }))
}

const CustomTooltip = ({ active, payload, label, mode }: any) => {
  if (!active || !payload) return null
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2.5 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value} {mode === 'distance' ? 'km' : 'h'}
        </p>
      ))}
    </div>
  )
}

export default function VolumeChart({ sessions, mode }: Props) {
  const data = buildChartData(sessions, mode)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <Tooltip content={<CustomTooltip mode={mode} />} />
        <Line type="monotone" dataKey="Swim" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Ride" stroke="#F97316" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Run" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
