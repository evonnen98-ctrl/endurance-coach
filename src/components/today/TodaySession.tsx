import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Flag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Session, Checkin } from '../../types'
import { disciplineLabel } from '../../lib/discipline'
import WorkoutLogModal from '../modals/WorkoutLogModal'

interface Props {
  session: Session
  checkin?: Checkin
  weekSessions?: Session[]
}

const KEY_SESSION_TYPES = new Set(['long', 'tempo', 'interval', 'brick', 'speed'])

const discLabelStyle: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
}

const pillBtnStyle: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  borderRadius: 999,
}

export default function TodaySession({ session, checkin, weekSessions = [] }: Props) {
  const queryClient = useQueryClient()
  const [showLog, setShowLog]         = useState(false)
  const [completing, setCompleting]   = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  const isComplete = session.status === 'complete' || justCompleted
  const isRest     = session.discipline === 'rest'
  const isRaceDay  = session.session_type === 'race'
  const isKeySession = KEY_SESSION_TYPES.has(session.session_type ?? '')

  const completedThisWeek = weekSessions.filter(
    s => s.status === 'complete' || (s.id === session.id && justCompleted)
  ).length
  const totalThisWeek  = weekSessions.filter(s => s.discipline !== 'rest').length
  const isWeekComplete = completedThisWeek === totalThisWeek && totalThisWeek > 0

  const detailParts = [
    session.distance_km   ? `${session.distance_km}km` : null,
    session.effort_zone   ? session.effort_zone         : null,
    session.target_pace   ? session.target_pace         : null,
  ].filter(Boolean) as string[]

  const coachNote = checkin?.coach_response ?? session.coaching_rationale ?? null

  async function markComplete() {
    if (isRest) {
      setCompleting(true)
      await supabase.from('sessions').update({ status: 'complete' }).eq('id', session.id)
      await queryClient.invalidateQueries({ queryKey: ['today-session'] })
      await queryClient.invalidateQueries({ queryKey: ['week-sessions'] })
      setJustCompleted(true)
      setCompleting(false)
      return
    }
    setShowLog(true)
  }

  function handleLogClose() {
    setShowLog(false)
    setJustCompleted(true)
  }

  // ── Race day hero ─────────────────────────────────────────────────────────
  if (isRaceDay) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--ink)' }}>
        <div className="px-6 pt-6 pb-4 text-center">
          <Flag size={28} style={{ color: 'var(--volt)', margin: '0 auto 12px' }} />
          <h2 style={{ fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 800, fontSize: 22, letterSpacing: '-0.01em', lineHeight: 0.95, textTransform: 'uppercase', color: '#FFFFFF' }}>
            {session.title}
          </h2>
          {session.description && (
            <p className="text-[14px] mt-2 leading-relaxed font-medium" style={{ color: 'var(--graphite-300)' }}>
              {session.description}
            </p>
          )}
        </div>
        <div className="mx-4 mb-4 rounded-lg px-4 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[13px] leading-relaxed font-medium text-center" style={{ color: 'var(--graphite-300)' }}>
            Your training is done. Trust your preparation and race your race.
          </p>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={markComplete}
            disabled={completing || isComplete}
            className="w-full py-3.5 disabled:opacity-60 flex items-center justify-center"
            style={{ ...pillBtnStyle, backgroundColor: isComplete ? 'var(--graphite-500)' : '#FFFFFF', color: 'var(--ink)' }}
          >
            {completing
              ? <span className="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin" />
              : isComplete ? 'Race complete' : 'Mark race complete'}
          </button>
        </div>
      </div>
    )
  }

  // ── Regular session card ──────────────────────────────────────────────────
  return (
    <>
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid var(--graphite-300)' }}>
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              {/* Discipline label replaces emoji */}
              <span style={{ ...discLabelStyle, color: isComplete ? 'var(--graphite-300)' : 'var(--graphite-500)', paddingTop: 2, flexShrink: 0 }}>
                {disciplineLabel[session.discipline] ?? 'REST'}
              </span>
              <div className="min-w-0">
                {isKeySession && !isComplete && (
                  <p style={{ ...discLabelStyle, color: 'var(--graphite-300)', fontSize: 8, marginBottom: 2 }}>
                    Key session
                  </p>
                )}
                <span className={`text-[15px] font-semibold block truncate`} style={{ color: isComplete ? 'var(--graphite-300)' : 'var(--ink)' }}>
                  {session.title}
                </span>
                {detailParts.length > 0 && (
                  <p className="text-[12px] font-medium mt-1" style={{ color: 'var(--graphite-500)' }}>
                    {detailParts.join(' · ')}
                  </p>
                )}
                {coachNote && !isComplete && (
                  <p className="text-[12px] italic mt-0.5 line-clamp-1 font-medium" style={{ color: 'var(--graphite-300)' }}>
                    {coachNote}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isComplete && (
                <span style={{ ...discLabelStyle, color: 'var(--graphite-300)', fontSize: 9 }}>Done</span>
              )}
              {session.duration_minutes && (
                <span className="text-[13px] font-medium" style={{ color: 'var(--graphite-500)' }}>
                  {session.duration_minutes}min
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mark complete */}
        {!isComplete && (
          <button
            onClick={markComplete}
            disabled={completing}
            className="w-full flex items-center justify-center disabled:opacity-60"
            style={{ ...pillBtnStyle, backgroundColor: 'var(--ink)', color: '#FFFFFF', height: 40, borderRadius: 0 }}
          >
            {completing
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Mark complete'}
          </button>
        )}

        {/* Week complete */}
        {isComplete && isWeekComplete && (
          <div className="px-4 pb-3 pt-1 text-center">
            <p style={{ ...discLabelStyle, fontSize: 9, color: 'var(--graphite-300)' }}>Week complete</p>
          </div>
        )}

        {/* View log */}
        {isComplete && !isWeekComplete && !isRest && (
          <div className="px-4 pb-2.5">
            <button onClick={() => setShowLog(true)} className="text-[11px] font-medium" style={{ color: 'var(--graphite-300)', textDecoration: 'underline' }}>
              View log
            </button>
          </div>
        )}
      </div>

      {showLog && <WorkoutLogModal session={session} onClose={handleLogClose} />}
    </>
  )
}
