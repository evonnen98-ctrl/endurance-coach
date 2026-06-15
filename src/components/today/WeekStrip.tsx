import { useNavigate } from 'react-router-dom'
import { startOfWeek, addDays, isSameDay } from 'date-fns'
import type { Session } from '../../types'
import { disciplineColor } from '../../lib/discipline'

interface Props {
  sessions: Session[]
  today: Date
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function WeekStrip({ sessions, today }: Props) {
  const navigate  = useNavigate()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })

  const days = DAY_LABELS.map((label, i) => {
    const date        = addDays(weekStart, i)
    const daySessions = sessions.filter(s => isSameDay(new Date(s.scheduled_date + 'T12:00:00'), date))
    const isToday     = isSameDay(date, today)
    const isPast      = date < today && !isToday
    const allComplete = daySessions.length > 0 && daySessions.every(s => s.status === 'complete')
    return { label, date, sessions: daySessions, isToday, isPast, allComplete }
  })

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ backgroundColor: '#F3F4F6' }}
    >
      {/* Full plan link */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => navigate('/plan')}
          className="text-[11px] text-gray-400 font-medium"
        >
          Full plan &rsaquo;
        </button>
      </div>

      {/* Day columns — label above dot */}
      <div className="flex">
        {days.map(({ label, sessions: s, isToday, isPast, allComplete }, i) => {
          const hasSessions  = s.length > 0
          const primaryColor = hasSessions
            ? (disciplineColor[s[0].discipline] ?? '#6B7280')
            : '#D1D5DB'

          const dotColor = allComplete
            ? '#22C55E'
            : hasSessions
            ? primaryColor
            : '#D1D5DB'

          const dotOpacity = isPast && !allComplete && hasSessions ? 0.35 : 1

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Day letter */}
              <span
                className="text-[11px] font-semibold"
                style={{ color: isToday ? '#111827' : '#9CA3AF' }}
              >
                {label}
              </span>

              {/* Dot(s) */}
              <div className="relative flex items-center justify-center" style={{ width: 24, height: 16 }}>
                {/* Ring for today */}
                {isToday && (
                  <span
                    className="absolute rounded-full"
                    style={{
                      width: 20, height: 20,
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      border: `2px solid ${hasSessions ? primaryColor : '#D1D5DB'}`,
                      opacity: 0.3,
                    }}
                  />
                )}

                {s.length > 1 ? (
                  <div className="flex gap-0.5 items-center">
                    {s.slice(0, 3).map(sess => (
                      <span
                        key={sess.id}
                        className="rounded-full"
                        style={{
                          width:  isToday ? 8 : 6,
                          height: isToday ? 8 : 6,
                          backgroundColor: allComplete ? '#22C55E' : (disciplineColor[sess.discipline] ?? '#9CA3AF'),
                          opacity: dotOpacity,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <span
                    className="rounded-full"
                    style={{
                      width:  isToday ? 13 : hasSessions ? 10 : 8,
                      height: isToday ? 13 : hasSessions ? 10 : 8,
                      backgroundColor: dotColor,
                      opacity: dotOpacity,
                    }}
                  />
                )}
              </div>

              {/* Completed tick */}
              {allComplete && (
                <span className="text-[9px] text-green-500 leading-none">✓</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
