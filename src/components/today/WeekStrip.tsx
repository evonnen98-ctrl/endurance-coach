import { useNavigate } from 'react-router-dom'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import type { Session } from '../../types'
import { disciplineColor } from '../../lib/discipline'

interface Props {
  sessions: Session[]
  today: Date
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function WeekStrip({ sessions, today }: Props) {
  const navigate = useNavigate()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })

  const days = DAY_LABELS.map((label, i) => {
    const date = addDays(weekStart, i)
    const daySessions = sessions.filter(s => isSameDay(new Date(s.scheduled_date + 'T12:00:00'), date))
    const isToday = isSameDay(date, today)
    const isPast  = date < today && !isToday
    const allComplete = daySessions.length > 0 && daySessions.every(s => s.status === 'complete')
    return { label, date, sessions: daySessions, isToday, isPast, allComplete }
  })

  return (
    <div className="px-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-800">This week</span>
        <button
          onClick={() => navigate('/plan')}
          className="text-xs text-gray-400 hover:text-black font-medium"
        >
          Full plan &rsaquo;
        </button>
      </div>

      <div className="flex gap-1.5">
        {days.map(({ label, sessions: s, isToday, isPast, allComplete }, i) => {
          const hasSessions = s.length > 0
          const primaryColor = hasSessions
            ? disciplineColor[s[0].discipline] ?? '#6B7280'
            : '#E5E7EB'

          return (
            <div
              key={i}
              className={`flex-1 flex flex-col items-center py-3 rounded-xl transition-all ${
                isToday ? 'bg-white shadow-sm border border-gray-200' : 'bg-white/60'
              }`}
            >
              {/* Dot area */}
              <div className="relative flex items-center justify-center mb-1.5" style={{ width: 22, height: 22 }}>
                {/* Ring for today */}
                {isToday && hasSessions && (
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ border: `2px solid ${primaryColor}`, opacity: 0.35 }}
                  />
                )}
                {/* Multi-discipline: stack dots */}
                {s.length > 1 ? (
                  <div className="flex gap-0.5 items-center">
                    {s.slice(0, 3).map(sess => (
                      <span
                        key={sess.id}
                        className="rounded-full"
                        style={{
                          width: isToday ? 9 : 7,
                          height: isToday ? 9 : 7,
                          backgroundColor: allComplete ? '#86EFAC' : disciplineColor[sess.discipline] ?? '#9CA3AF',
                          opacity: isPast && !allComplete ? 0.4 : 1,
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
                      backgroundColor: allComplete
                        ? '#22C55E'
                        : hasSessions
                        ? primaryColor
                        : '#E5E7EB',
                      opacity: isPast && !allComplete && hasSessions ? 0.4 : 1,
                    }}
                  />
                )}
              </div>

              {/* Day label below */}
              <span
                className="text-[10px] font-semibold"
                style={{ color: isToday ? '#111827' : '#9CA3AF' }}
              >
                {label}
              </span>

              {/* Completed tick */}
              {allComplete && (
                <span className="text-[9px] text-green-500 mt-0.5 leading-none">✓</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
