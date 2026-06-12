import { isSameWeek, parseISO } from 'date-fns'
import type { Session } from '../../types'
import SessionRow from './SessionRow'

interface Props {
  weekNumber: number
  sessions: Session[]
  today: Date
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function volumeSummary(sessions: Session[]) {
  const swim = sessions.filter(s => s.discipline === 'swim').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  const ride = sessions.filter(s => s.discipline === 'ride' || s.discipline === 'brick').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  const run = sessions.filter(s => s.discipline === 'run').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  return { swim, ride, run }
}

export default function WeekSection({ weekNumber, sessions, today }: Props) {
  const sorted = [...sessions].sort((a, b) => a.day_of_week - b.day_of_week)
  const firstSession = sorted[0]
  const isCurrentWeek = firstSession
    ? isSameWeek(parseISO(firstSession.scheduled_date), today, { weekStartsOn: 1 })
    : false

  const vol = volumeSummary(sessions)

  return (
    <div>
      {/* Week header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Week {weekNumber}
          </span>
          {isCurrentWeek && (
            <span className="text-[10px] font-semibold bg-black text-white px-2 py-0.5 rounded-full uppercase tracking-widest">
              This week
            </span>
          )}
        </div>
        <div className="flex gap-3 text-xs">
          {vol.swim > 0 && <span className="text-blue-500 font-medium">Swim {vol.swim.toFixed(1)}km</span>}
          {vol.ride > 0 && <span className="text-orange-500 font-medium">Ride {vol.ride}km</span>}
          {vol.run > 0 && <span className="text-green-500 font-medium">Run {vol.run}km</span>}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map(session => (
          <SessionRow
            key={session.id}
            session={session}
            dayLabel={DAY_LABELS[session.day_of_week]}
          />
        ))}
      </div>
    </div>
  )
}
