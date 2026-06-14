import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import type { Session } from '../../types'
import { disciplineColor, disciplineLabel } from '../../lib/discipline'
import WorkoutLogModal from '../modals/WorkoutLogModal'

interface Props {
  session: Session
  dayLabel: string
}

export default function SessionRow({ session, dayLabel }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  const isRest     = session.discipline === 'rest'
  const isComplete = session.status === 'complete'
  const isMissed   = session.status === 'missed'
  const isModified = session.status === 'modified'
  const dotColor   = disciplineColor[session.discipline]

  const durationLabel = session.duration_minutes
    ? session.duration_minutes >= 60
      ? `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60 > 0 ? session.duration_minutes % 60 + 'min' : ''}`
      : `${session.duration_minutes}min`
    : '—'

  async function saveNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    await supabase.from('workout_logs').insert({
      session_id:  session.id,
      user_id:     DEMO_USER_ID,
      user_note:   noteText.trim(),
      source:      'manual',
      logged_at:   new Date().toISOString(),
    })
    setNoteSaved(true)
    setSavingNote(false)
    setShowNote(false)
  }

  return (
    <>
      <div className={`bg-white rounded-xl border overflow-hidden ${isMissed ? 'border-red-100 opacity-70' : 'border-gray-100'}`}>
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="text-xs text-gray-400 font-medium w-7 flex-shrink-0">{dayLabel}</span>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`font-semibold text-sm ${isComplete || isMissed ? 'text-gray-400' : 'text-black'}`}>
                {session.title}
              </span>
              {isModified && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Modified</span>
              )}
            </div>
            {session.description && (
              <p className="text-xs text-gray-400 truncate">{session.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isComplete && <span className="text-[10px] text-green-500">✓</span>}
            {isMissed && <span className="text-[10px] text-red-400">Missed</span>}
            <span className="text-xs text-gray-400">{isRest ? '—' : durationLabel}</span>
            <span className="text-gray-300 text-sm">{expanded ? '∧' : '∨'}</span>
          </div>
        </button>

        {expanded && !isRest && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
            {/* Missed session note */}
            {isMissed && (
              <div className="bg-red-50 rounded-xl px-3 py-2.5">
                <p className="text-sm text-red-700">Missed session — no stress. Your coach has factored this into upcoming sessions.</p>
              </div>
            )}

            {/* Modification reason */}
            {isModified && session.modification_reason && (
              <div className="bg-amber-50 rounded-xl px-3 py-2.5">
                <div className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-1">Why this changed</div>
                <p className="text-sm text-amber-800 leading-relaxed">{session.modification_reason}</p>
              </div>
            )}

            {/* Coaching rationale */}
            {session.coaching_rationale && !isMissed && (
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
                    {session.discipline === 'ride' ? 'Target speed' : session.discipline === 'swim' ? 'Target pace' : 'Target pace'}
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

            {/* Session note (#8) */}
            {showNote ? (
              <div>
                <textarea
                  rows={2}
                  autoFocus
                  placeholder="How did this feel? Any issues?"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={saveNote}
                    disabled={!noteText.trim() || savingNote}
                    className="px-4 py-2 bg-black text-white text-xs font-semibold rounded-xl disabled:opacity-40"
                  >
                    {savingNote ? 'Saving…' : 'Save note'}
                  </button>
                  <button
                    onClick={() => setShowNote(false)}
                    className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-3 text-xs text-gray-400">
                  {session.effort_zone && <span>Effort: {session.effort_zone}</span>}
                  {session.duration_minutes && <span>{durationLabel}</span>}
                </div>
                <div className="flex gap-3">
                  {/* Note icon */}
                  <button
                    onClick={e => { e.stopPropagation(); setShowNote(true) }}
                    className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-xs"
                    title="Add a note"
                  >
                    <MessageSquare size={13} />
                    {noteSaved ? <span className="text-green-500">Saved</span> : 'Note'}
                  </button>
                  {!isComplete && !isMissed && (
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
        )}
      </div>

      {showLog && (
        <WorkoutLogModal session={session} onClose={() => setShowLog(false)} />
      )}
    </>
  )
}
