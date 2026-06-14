import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Send } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { WorkoutLog, Session } from '../../types'
import { disciplineColor } from '../../lib/discipline'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'

interface Props {
  log: WorkoutLog
  session?: Session
}

export default function WorkoutHistoryEntry({ log, session }: Props) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded]         = useState(false)
  const [note, setNote]                 = useState('')
  const [sending, setSending]           = useState(false)
  const [localCoachResp, setLocalCoachResp] = useState(log.coach_response ?? '')

  const discipline = session?.discipline ?? 'run'
  const title      = session?.title ?? 'Workout'
  const date       = format(parseISO(log.logged_at), 'EEE d MMM')

  async function sendNote(e: React.MouseEvent) {
    e.stopPropagation()
    if (!note.trim() || sending) return
    setSending(true)

    // Save the note to the log
    await supabase
      .from('workout_logs')
      .update({ user_note: note.trim() })
      .eq('id', log.id)

    // Get coach response
    try {
      const res = await api.postWorkout({
        userId:                  DEMO_USER_ID,
        workoutLogId:            log.id,
        sessionId:               log.session_id ?? undefined,
        rpe:                     log.rpe ?? 6,
        user_note:               note.trim(),
        actual_distance_km:      log.actual_distance_km ?? undefined,
        actual_duration_minutes: log.actual_duration_minutes ?? undefined,
      })
      setLocalCoachResp(res.coach_response)
      await supabase
        .from('workout_logs')
        .update({ coach_response: res.coach_response })
        .eq('id', log.id)
    } catch {
      setLocalCoachResp("Thanks for the update — I'll keep that in mind when planning your next sessions.")
    }

    setNote('')
    setSending(false)
    queryClient.invalidateQueries({ queryKey: ['workout-logs'] })
  }

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
        <div
          className="px-4 pb-4 pt-0 space-y-3 border-t border-gray-50"
          onClick={e => e.stopPropagation()}
        >
          {log.user_note && (
            <p className="text-sm text-gray-700 pt-3">{log.user_note}</p>
          )}
          {localCoachResp && (
            <div className="bg-stone-50 rounded-xl px-3 py-2.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Coach</span>
              <p className="text-sm text-gray-700 mt-1 leading-relaxed">{localCoachResp}</p>
            </div>
          )}
          {log.injury_flag && (
            <p className="text-xs text-red-600 font-medium">⚠️ Injury flag noted</p>
          )}

          {/* Post-workout coach chat */}
          <div className="pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              {localCoachResp ? 'Add a note' : 'Tell your coach how it went'}
            </p>
            <div className="flex gap-2 items-end">
              <textarea
                rows={2}
                placeholder={localCoachResp ? 'Any updates for your coach...' : 'How did it feel? Any issues?'}
                value={note}
                onChange={e => setNote(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 resize-none"
              />
              <button
                onClick={sendNote}
                disabled={sending || !note.trim()}
                className="p-3 bg-gray-900 text-white rounded-xl disabled:opacity-40 flex-shrink-0"
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                  : <Send size={16} />
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
