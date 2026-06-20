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

function getPhaseLabel(weekNumber: number, totalWeeks: number): string {
  const weeksFromEnd = totalWeeks - weekNumber
  if (weeksFromEnd === 0) return 'Race Week'
  if (weeksFromEnd <= 2)  return 'Taper'
  if (weeksFromEnd <= 4)  return 'Peak'
  const buildStart = Math.floor(totalWeeks * 0.4)
  if (weekNumber <= buildStart) return 'Base'
  return 'Build'
}

function volumeSummary(sessions: Session[]) {
  const swim = sessions.filter(s => s.discipline === 'swim').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  const ride = sessions.filter(s => s.discipline === 'ride' || s.discipline === 'brick').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  const run  = sessions.filter(s => s.discipline === 'run').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  return { swim, ride, run }
}

const volLabelStyle: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--graphite-300)',
}

export default function WeekSection({ weekNumber, totalWeeks, sessions, today, planStartDate, showOriginal = false }: Props) {
  const sorted = [...sessions].sort((a, b) => a.day_of_week - b.day_of_week)
  const firstSession = sorted[0]
  const isCurrentWeek = firstSession
    ? isSameWeek(parseISO(firstSession.scheduled_date), today, { weekStartsOn: 1 })
    : false

  const [isExpanded, setIsExpanded] = useState(isCurrentWeek)

  const vol   = volumeSummary(sessions)
  const phase = getPhaseLabel(weekNumber, totalWeeks)

  const wcLabel = planStartDate
    ? `w/c ${format(addDays(parseISO(planStartDate), (weekNumber - 1) * 7), 'd MMM')}`
    : null

  return (
    <div
      className={isCurrentWeek ? 'pl-3' : ''}
      style={isCurrentWeek ? { borderLeft: '3px solid var(--volt)' } : {}}
    >
      <button
        className="w-full flex items-center justify-between mb-2 text-left"
        onClick={() => setIsExpanded(e => !e)}
      >
        {/* Left: week label + phase + date */}
        <div className="flex items-center gap-1.5 min-w-0 mr-2">
          <span className="text-[13px] font-semibold" style={{ color: isCurrentWeek ? 'var(--ink)' : 'var(--graphite-500)' }}>
            Week {weekNumber}
          </span>
          <span style={{ color: 'var(--graphite-300)', fontSize: 11 }}>·</span>
          <span className="text-[11px] font-medium" style={{ color: 'var(--graphite-500)' }}>{phase}</span>
          {wcLabel && (
            <>
              <span style={{ color: 'var(--graphite-300)', fontSize: 11 }}>·</span>
              <span className="text-[11px] font-medium" style={{ color: 'var(--graphite-300)' }}>{wcLabel}</span>
            </>
          )}
          {isCurrentWeek && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1" style={{
              fontFamily: '"Archivo", sans-serif',
              fontStretch: '125%',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              backgroundColor: 'var(--mist)',
              color: 'var(--graphite-500)',
            }}>
              now
            </span>
          )}
        </div>

        {/* Right: volume + chevron */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex gap-2">
            {vol.swim > 0 && <span style={volLabelStyle}>SWM {vol.swim.toFixed(0)}</span>}
            {vol.ride > 0 && <span style={volLabelStyle}>RDE {vol.ride.toFixed(0)}</span>}
            {vol.run  > 0 && <span style={volLabelStyle}>RUN {vol.run.toFixed(0)}</span>}
          </div>
          <ChevronRight
            size={14}
            strokeWidth={2}
            style={{ color: 'var(--graphite-300)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}
          />
        </div>
      </button>

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
