import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import type { Session } from '../../types'
import { disciplineColor, disciplineLabel } from '../../lib/discipline'
import WorkoutLogModal from '../modals/WorkoutLogModal'

interface Props {
  session: Session
  dayLabel: string
  showOriginal?: boolean
}

const discLabelStyle: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

export default function SessionRow({ session, dayLabel, showOriginal = false }: Props) {
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
  const isKeySession = session.session_type === 'interval' || session.session_type === 'tempo'
  const dotColor   = disciplineColor[session.discipline]

  const orig = (isModified && showOriginal && session.original_data) ? session.original_data as Session : null
  const displayTitle    = orig ? orig.title    : session.title
  const displayDuration = orig ? orig.duration_minutes : session.duration_minutes
  const displayDesc     = orig ? orig.description : session.description

  const durationLabel = displayDuration
    ? displayDuration >= 60
      ? `${Math.floor(displayDuration / 60)}h ${displayDuration % 60 > 0 ? displayDuration % 60 + 'min' : ''}`
      : `${displayDuration}min`
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
      <div className={`bg-white rounded-xl overflow-hidden ${isMissed ? 'opacity-50' : ''}`} style={{ border: '1px solid var(--graphite-300)' }}>
        <button
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
          onClick={() => setExpanded(e => !e)}
        >
          <span className="text-[11px] font-semibold w-7 flex-shrink-0" style={{ color: 'var(--graphite-300)' }}>{dayLabel}</span>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold" style={{ color: isComplete || isMissed ? 'var(--graphite-300)' : 'var(--ink)' }}>
                {displayTitle}
              </span>
              {isKeySession && !isComplete && !isMissed && (
                <span style={{ ...discLabelStyle, backgroundColor: 'var(--ink)', color: '#FFFFFF', padding: '2px 6px', borderRadius: 4 }}>
                  Key
                </span>
              )}
              {isModified && (
                <span style={{ ...discLabelStyle, backgroundColor: 'var(--mist)', color: 'var(--graphite-500)', padding: '2px 6px', borderRadius: 4 }}>
                  {showOriginal ? 'Original' : 'Modified'}
                </span>
              )}
            </div>
            {displayDesc && (
              <p className="text-[12px] font-medium truncate mt-0.5" style={{ color: 'var(--graphite-500)' }}>{displayDesc}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isComplete && <span className="text-[10px] font-semibold" style={{ color: 'var(--graphite-300)' }}>Done</span>}
            {isMissed && <span className="text-[10px] font-medium" style={{ color: 'var(--graphite-300)' }}>Missed</span>}
            <span className="text-[13px] font-medium" style={{ color: 'var(--graphite-500)' }}>{isRest ? '—' : durationLabel}</span>
            <ChevronIcon expanded={expanded} />
          </div>
        </button>

        {expanded && !isRest && (
          <div className="px-4 pb-4 space-y-3 pt-3" style={{ borderTop: '1px solid var(--mist)' }}>
            {isMissed && (
              <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--mist)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--graphite-500)' }}>Missed session — no stress. Your coach has factored this into upcoming sessions.</p>
              </div>
            )}

            {isModified && session.modification_reason && (
              <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--mist)' }}>
                <div style={{ ...discLabelStyle, color: 'var(--graphite-500)', marginBottom: 4 }}>Why this changed</div>
                <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{session.modification_reason}</p>
              </div>
            )}

            {session.coaching_rationale && !isMissed && (
              <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--mist)' }}>
                <div style={{ ...discLabelStyle, color: 'var(--graphite-300)', marginBottom: 4 }}>Why this session</div>
                <p className="text-[14px] font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{session.coaching_rationale}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {session.target_pace && (
                <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--mist)' }}>
                  <div style={{ ...discLabelStyle, color: 'var(--graphite-300)', marginBottom: 2 }}>
                    {session.discipline === 'ride' ? 'Target speed' : 'Target pace'}
                  </div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{session.target_pace}</div>
                </div>
              )}
              {session.effort_zone && (
                <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--mist)' }}>
                  <div style={{ ...discLabelStyle, color: 'var(--graphite-300)', marginBottom: 2 }}>Effort</div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{session.effort_zone}</div>
                </div>
              )}
            </div>

            {session.session_structure && session.session_structure.length > 0 && (
              <div>
                <div style={{ ...discLabelStyle, color: 'var(--graphite-300)', marginBottom: 8 }}>Session structure</div>
                <ol className="space-y-1">
                  {session.session_structure.map((step, i) => (
                    <li key={i} className="flex gap-2 text-[14px] font-medium" style={{ color: 'var(--ink)' }}>
                      <span style={{ color: 'var(--graphite-300)', flexShrink: 0 }}>{i + 1}.</span>
                      <span>{step.description}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {showNote ? (
              <div>
                <textarea
                  rows={2}
                  autoFocus
                  placeholder="How did this feel? Any issues?"
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  className="w-full p-3 rounded-lg text-sm resize-none"
                  style={{ border: '1px solid var(--graphite-300)', backgroundColor: '#FFFFFF', color: 'var(--ink)' }}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={saveNote}
                    disabled={!noteText.trim() || savingNote}
                    className="px-4 py-2 text-xs disabled:opacity-40"
                    style={{
                      fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 800,
                      letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: 999,
                      backgroundColor: 'var(--volt)', color: 'var(--ink)',
                    }}
                  >
                    {savingNote ? 'Saving…' : 'Save note'}
                  </button>
                  <button
                    onClick={() => setShowNote(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-full"
                    style={{ border: '1px solid var(--graphite-300)', color: 'var(--graphite-500)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <div className="flex gap-3 text-xs font-medium" style={{ color: 'var(--graphite-300)' }}>
                  {session.effort_zone && <span>Effort: {session.effort_zone}</span>}
                  {session.duration_minutes && <span>{durationLabel}</span>}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={e => { e.stopPropagation(); setShowNote(true) }}
                    className="flex items-center gap-1 text-xs font-medium"
                    style={{ color: 'var(--graphite-500)' }}
                  >
                    <MessageSquare size={12} />
                    {noteSaved ? 'Saved' : 'Note'}
                  </button>
                  {!isComplete && !isMissed && (
                    <button
                      onClick={e => { e.stopPropagation(); setShowLog(true) }}
                      className="text-xs font-semibold underline"
                      style={{ color: 'var(--graphite-500)' }}
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

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      style={{ color: 'var(--graphite-300)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
    >
      <path d="M4.5 2.5L7.5 6L4.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
