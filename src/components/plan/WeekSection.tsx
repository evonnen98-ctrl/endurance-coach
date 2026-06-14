import { useState } from 'react'
import { isSameWeek, parseISO } from 'date-fns'
import type { Session } from '../../types'
import SessionRow from './SessionRow'

interface Props {
  weekNumber: number
  sessions: Session[]
  today: Date
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Maps week number to load type using the same periodisation multipliers
function weekLoadBadge(week: number): { emoji: string; label: string; tooltip: string; color: string } {
  if (week === 12) return { emoji: '⚪', label: 'Taper', tooltip: 'Minimal volume, race-pace efforts only. Trust the work you\'ve done.', color: 'text-gray-500' }
  if (week === 4 || week === 8) return { emoji: '🔵', label: 'Recovery', tooltip: 'Volume drops 30-40%. Your body adapts during rest — protect it.', color: 'text-blue-500' }
  if (week >= 9 && week <= 11) return { emoji: '🔴', label: 'Peak', tooltip: 'Highest volume week. This is where fitness is built — stay consistent.', color: 'text-red-500' }
  if (week >= 5 && week <= 7) return { emoji: '🟡', label: 'Build', tooltip: 'Volume increasing. Quality sessions are key this block.', color: 'text-yellow-500' }
  return { emoji: '🟢', label: 'Base', tooltip: 'Foundation building. Keep easy sessions genuinely easy.', color: 'text-green-600' }
}

function volumeSummary(sessions: Session[]) {
  const swim = sessions.filter(s => s.discipline === 'swim').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  const ride = sessions.filter(s => s.discipline === 'ride' || s.discipline === 'brick').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  const run  = sessions.filter(s => s.discipline === 'run').reduce((a, s) => a + (s.distance_km ?? 0), 0)
  return { swim, ride, run }
}

export default function WeekSection({ weekNumber, sessions, today }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)

  const sorted = [...sessions].sort((a, b) => a.day_of_week - b.day_of_week)
  const firstSession = sorted[0]
  const isCurrentWeek = firstSession
    ? isSameWeek(parseISO(firstSession.scheduled_date), today, { weekStartsOn: 1 })
    : false

  const vol  = volumeSummary(sessions)
  const badge = weekLoadBadge(weekNumber)

  return (
    <div>
      {/* Week header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Week {weekNumber}
          </span>
          {isCurrentWeek && (
            <span className="text-[10px] font-semibold bg-black text-white px-2 py-0.5 rounded-full uppercase tracking-widest">
              This week
            </span>
          )}
          {/* Load badge (#9) */}
          <div className="relative">
            <button
              className={`text-[11px] font-medium flex items-center gap-1 ${badge.color}`}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onTouchStart={() => setShowTooltip(v => !v)}
            >
              {badge.emoji} {badge.label}
            </button>
            {showTooltip && (
              <div className="absolute top-full left-0 mt-1 z-10 bg-gray-900 text-white text-xs rounded-xl px-3 py-2 w-52 shadow-lg">
                {badge.tooltip}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 text-xs">
          {vol.swim > 0 && <span className="text-blue-500 font-medium">Swim {vol.swim.toFixed(1)}km</span>}
          {vol.ride > 0 && <span className="text-orange-500 font-medium">Ride {vol.ride}km</span>}
          {vol.run  > 0 && <span className="text-green-500 font-medium">Run {vol.run}km</span>}
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
