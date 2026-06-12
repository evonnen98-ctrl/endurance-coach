import { useState } from 'react'
import type { Session } from '../../types'
import { disciplineColor, disciplineLabel } from '../../lib/discipline'
import WorkoutLogModal from '../modals/WorkoutLogModal'

interface Props {
  session: Session
  dayLabel: string
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function SessionRow({ session, dayLabel }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showLog, setShowLog] = useState(false)

  const isRest = session.discipline === 'rest'
  const isComplete = session.status === 'complete'
  const dotColor = disciplineColor[session.discipline]

  const durationLabel = session.duration_minutes
    ? session.duration_minutes >= 60
      ? `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60 > 0 ? session.duration_minutes % 60 + ' min' : ''}`
      : `${session.duration_minutes} min`
    : '—'

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="text-xs text-gray-400 font-medium w-7 flex-shrink-0">{dayLabel}</span>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`font-semibold text-sm ${isComplete ? 'text-gray-400' : 'text-black'}`}>
                {session.title}
              </span>
            </div>
            {session.description && (
              <p className="text-xs text-gray-400 truncate">{session.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isComplete && <span className="text-[10px] text-gray-400">✓</span>}
            <span className="text-xs text-gray-400">{isRest ? '—' : durationLabel}</span>
            <span className="text-gray-300 text-sm">{expanded ? '∧' : '∨'}</span>
          </div>
        </button>

        {expanded && !isRest && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
            {/* Rationale */}
            {session.coaching_rationale && (
              <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Why this session</div>
                <p className="text-sm text-gray-700 leading-relaxed">{session.coaching_rationale}</p>
              </div>
            )}

            {/* Targets */}
            <div className="grid grid-cols-2 gap-2">
              {session.target_pace && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">
                    {session.discipline === 'ride' ? 'Target speed' : 'Target pace'}
                  </div>
                  <div className="text-sm font-semibold">{session.target_pace}</div>
                </div>
              )}
              {session.effort_zone && (
                <div className="bg-gray-50 rounded-xl px-3 py-2">
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Effort</div>
                  <div className="text-sm font-semibold">{session.effort_zone}</div>
                </div>
              )}
            </div>

            {/* Session structure */}
            {session.session_structure && session.session_structure.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Session structure</div>
                <ol className="space-y-1">
                  {session.session_structure.map((step, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-gray-400 flex-shrink-0">{i + 1}.</span>
                      <span>{step.description}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-3 text-xs text-gray-500">
                {session.effort_zone && <span>Target effort: {session.effort_zone}</span>}
                {session.duration_minutes && <span>Duration: {durationLabel}</span>}
              </div>
              {!isComplete && (
                <button
                  onClick={e => { e.stopPropagation(); setShowLog(true) }}
                  className="text-xs font-medium text-gray-600 underline"
                >
                  Log workout
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showLog && (
        <WorkoutLogModal session={session} onClose={() => setShowLog(false)} />
      )}
    </>
  )
}
