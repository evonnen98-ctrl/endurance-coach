import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { isSameWeek, parseISO, addDays, format } from 'date-fns'
import type { Session } from '../../types'
import SessionRow from './SessionRow'

interface Props {
  weekNumber: number
  totalWeeks: number
  sessions: Session[]
  today: Date
  planStartDate?: string
  showOriginal?: boolean
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getPhaseLabel(weekNumber: number, totalWeeks: number): { label: string; color: string } {
  const weeksFromEnd = totalWeeks - weekNumber
  if (weeksFromEnd === 0) return { label: 'Race Week', color: 'text-amber-500' }
  if (weeksFromEnd <= 2)  return { label: 'Taper',     color: 'text-gray-500'  }
  if (weeksFromEnd <= 4)  return { label: 'Peak',      color: 'text-red-500'   }
  const buildStart = Math.floor(totalWeeks * 0.4)
  if (weekNumber <= buildStart) return { label: 'Base',  color: 'text-blue-500'  }
  return { label: 'Build', color: 'text-amber-500' }
}

function volumeSummary(sessions: Session[]) {
  const swim = sessions.filter(s => s.discipline === 'swim').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  const ride = sessions.filter(s => s.discipline === 'ride' || s.discipline === 'brick').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  const run  = sessions.filter(s => s.discipline === 'run').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  return { swim, ride, run }
}

export default function WeekSection({ weekNumber, totalWeeks, sessions, today, planStartDate, showOriginal = false }: Props) {
  const sorted = [...sessions].sort((a, b) => a.day_of_week - b.day_of_week)
  const firstSession = sorted[0]
  const isCurrentWeek = firstSession
    ? isSameWeek(parseISO(firstSession.scheduled_date), today, { weekStartsOn: 1 })
    : false

  const [isExpanded, setIsExpanded] = useState(isCurrentWeek)

  const vol   = volumeSummary(sessions)
  const badge = getPhaseLabel(weekNumber, totalWeeks)

  const wcLabel = planStartDate
    ? `w/c ${format(addDays(parseISO(planStartDate), (weekNumber - 1) * 7), 'd MMM')}`
    : null

  return (
    <div>
      {/* Collapsed / header row — always clickable */}
      <button
        className="w-full flex items-center justify-between mb-2 text-left group"
        onClick={() => setIsExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">
            Week {weekNumber}{wcLabel ? ` · ${wcLabel}` : ''}
          </span>
          {isCurrentWeek && (
            <span className="text-xs font-medium bg-black text-white px-2 py-0.5 rounded-full">
              This week
            </span>
          )}
          <span className={`text-xs font-medium ${badge.color}`}>{badge.label}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Volume summary — always visible */}
          <div className="flex gap-2 text-xs">
            {vol.swim > 0 && <span className="text-blue-500 font-medium">🏊 {vol.swim.toFixed(1)}km</span>}
            {vol.ride > 0 && <span className="text-orange-500 font-medium">🚴 {vol.ride}km</span>}
            {vol.run  > 0 && <span className="text-green-500 font-medium">🏃 {vol.run}km</span>}
          </div>
          <ChevronRight
            size={16}
            className={`text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
          />
        </div>
      </button>

      {/* Sessions — only when expanded */}
      {isExpanded && (
        <div className="space-y-2">
          {sorted.map(session => (
            <SessionRow
              key={session.id}
              session={session}
              dayLabel={DAY_LABELS[session.day_of_week]}
              showOriginal={showOriginal}
            />
          ))}
        </div>
      )}
    </div>
  )
}
