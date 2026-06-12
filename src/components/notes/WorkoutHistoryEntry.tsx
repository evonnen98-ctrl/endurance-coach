import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { WorkoutLog, Session } from '../../types'
import { disciplineColor, disciplineLabel } from '../../lib/discipline'

interface Props {
  log: WorkoutLog
  session?: Session
}

export default function WorkoutHistoryEntry({ log, session }: Props) {
  const [expanded, setExpanded] = useState(false)

  const discipline = session?.discipline ?? 'run'
  const title = session?.title ?? 'Workout'
  const date = format(parseISO(log.logged_at), 'EEE d MMM')

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer"
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: disciplineColor[discipline] }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-sm truncate">{title}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{date}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {log.actual_distance_km && <span>{log.actual_distance_km} km</span>}
            {log.actual_duration_minutes && <span>{log.actual_duration_minutes} min</span>}
            {log.rpe && <span>RPE {log.rpe}</span>}
          </div>
          {log.user_note && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{log.user_note}</p>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-50">
          {log.user_note && (
            <p className="text-sm text-gray-700 pt-3">{log.user_note}</p>
          )}
          {log.coach_response && (
            <div className="bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Coach</span>
              <p className="text-sm text-gray-700 mt-1 leading-relaxed">{log.coach_response}</p>
            </div>
          )}
          {log.injury_flag && (
            <p className="text-xs text-red-600 font-medium">⚠️ Injury flag noted</p>
          )}
        </div>
      )}
    </div>
  )
}
