import { useNavigate } from 'react-router-dom'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'
import type { Session } from '../../types'
import { disciplineColor } from '../../lib/discipline'

interface Props {
  sessions: Session[]
  today: Date
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeekStrip({ sessions, today }: Props) {
  const navigate = useNavigate()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })

  const days = DAY_LABELS.map((label, i) => {
    const date = addDays(weekStart, i)
    const daySessions = sessions.filter(s => isSameDay(new Date(s.scheduled_date), date))
    const isToday = isSameDay(date, today)
    const allComplete = daySessions.length > 0 && daySessions.every(s => s.status === 'complete')
    return { label, date, sessions: daySessions, isToday, allComplete }
  })

  return (
    <div className="px-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-base">This week</span>
        <button
          onClick={() => navigate('/plan')}
          className="text-sm text-gray-500 hover:text-black"
        >
          Full plan &rsaquo;
        </button>
      </div>
      <div className="flex gap-2">
        {days.map(({ label, sessions: s, isToday, allComplete }) => (
          <div
            key={label}
            className={`flex-1 flex flex-col items-center py-3 rounded-xl border transition-all ${
              isToday
                ? 'border-black bg-white shadow-sm'
                : 'border-gray-100 bg-white'
            }`}
          >
            <span className="text-[10px] text-gray-400 font-medium mb-1">{label}</span>
            <div className="flex gap-0.5 h-3 items-center justify-center">
              {s.length === 0 ? (
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
              ) : (
                s.map(sess => (
                  <span
                    key={sess.id}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: disciplineColor[sess.discipline] }}
                  />
                ))
              )}
            </div>
            {allComplete && (
              <span className="text-[10px] text-gray-400 mt-1">✓</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
