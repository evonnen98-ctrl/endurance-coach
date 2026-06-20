import { useNavigate } from 'react-router-dom'
import { startOfWeek, addDays, isSameDay } from 'date-fns'
import { Check } from 'lucide-react'
import type { Session } from '../../types'

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
    <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--mist)', borderRadius: 10 }}>
      <div className="flex justify-end mb-2.5">
        <button
          onClick={() => navigate('/plan')}
          style={{
            fontFamily: '"Archivo", sans-serif',
            fontStretch: '125%',
            fontWeight: 700,
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--graphite-500)',
          }}
        >
          Full plan &rsaquo;
        </button>
      </div>

      <div className="flex">
        {days.map(({ label, sessions: s, isToday, isPast, allComplete }, i) => {
          const hasSessions = s.length > 0
          const dotColor = allComplete ? 'var(--ink)' : hasSessions ? 'var(--graphite-300)' : '#E4E5E7'
          const dotOpacity = isPast && !allComplete && hasSessions ? 0.35 : 1

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Day letter */}
              <span style={{
                fontFamily: '"Archivo", sans-serif',
                fontStretch: '125%',
                fontWeight: isToday ? 800 : 600,
                fontSize: 10,
                letterSpacing: '0.08em',
                color: isToday ? 'var(--ink)' : 'var(--graphite-300)',
                textTransform: 'uppercase',
              }}>
                {label}
              </span>

              {/* Dot(s) */}
              <div className="relative flex items-center justify-center" style={{ width: 24, height: 16 }}>
                {isToday && (
                  <span
                    className="absolute rounded-full"
                    style={{
                      width: 22, height: 22,
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      border: '1.5px solid var(--ink)',
                      opacity: 0.2,
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
                          backgroundColor: dotColor,
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

              {/* Complete indicator */}
              {allComplete && (
                <Check size={9} style={{ color: 'var(--graphite-500)' }} strokeWidth={2.5} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
