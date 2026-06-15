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
        {/* Left: week label + phase + date — all inline, one line */}
        <div className="flex items-center gap-1.5 min-w-0 mr-2">
          <span className={`text-[13px] font-semibold ${isCurrentWeek ? 'text-gray-900' : 'text-gray-600'}`}>
            Week {weekNumber}
          </span>
          <span className="text-[11px] text-gray-300">·</span>
          <span className={`text-[11px] font-semibold ${badge.color}`}>{badge.label}</span>
          {wcLabel && (
            <>
              <span className="text-[11px] text-gray-300">·</span>
              <span className="text-[11px] text-gray-400">{wcLabel}</span>
            </>
          )}
          {isCurrentWeek && (
            <span className="text-[10px] font-semibold bg-black text-white px-1.5 py-0.5 rounded-full ml-1">now</span>
          )}
        </div>

        {/* Right: volume + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex gap-1.5 text-[11px]">
            {vol.swim > 0 && <span className="text-blue-500 font-medium">🏊 {vol.swim.toFixed(1)}</span>}
            {vol.ride > 0 && <span className="text-orange-500 font-medium">🚴 {vol.ride}</span>}
            {vol.run  > 0 && <span className="text-green-500 font-medium">🏃 {vol.run}</span>}
          </div>
          <ChevronRight
            size={14}
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
