import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Session, Checkin } from '../../types'
import WorkoutLogModal from '../modals/WorkoutLogModal'

interface Props {
  session: Session
  checkin?: Checkin
  weekSessions?: Session[]
}

const DISCIPLINE_EMOJI: Record<string, string> = {
  swim: '🏊', ride: '🚴', run: '🏃', brick: '🏊', rest: '😴',
}

const DISCIPLINE_COLOR: Record<string, string> = {
  swim: '#3B82F6', ride: '#F97316', run: '#22C55E',
  brick: '#F97316', rest: '#9CA3AF',
}

const KEY_SESSION_TYPES = new Set(['long', 'tempo', 'interval', 'brick', 'speed'])

export default function TodaySession({ session, checkin, weekSessions = [] }: Props) {
  const queryClient = useQueryClient()
  const [showLog, setShowLog]         = useState(false)
  const [completing, setCompleting]   = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  const isComplete = session.status === 'complete' || justCompleted
  const isRest     = session.discipline === 'rest'
  const isRaceDay  = session.session_type === 'race'

  const accentColor  = DISCIPLINE_COLOR[session.discipline] ?? '#9CA3AF'
  const emoji        = DISCIPLINE_EMOJI[session.discipline] ?? '🏃'
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
      <div className="bg-gradient-to-br from-black to-gray-900 rounded-lg overflow-hidden shadow-lg">
        <div className="px-6 pt-6 pb-4 text-center">
          <p className="text-5xl mb-3">🏁</p>
          <h2 className="text-[22px] font-bold text-white leading-snug">{session.title}</h2>
          {session.description && (
            <p className="text-[14px] text-gray-300 mt-2 leading-relaxed">{session.description}</p>
          )}
        </div>
        <div className="mx-4 mb-4 bg-white/10 rounded-xl px-4 py-3 text-center">
          <p className="text-[13px] text-gray-200 leading-relaxed">
            Your training is done. Trust your preparation and race your race.
          </p>
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={markComplete}
            disabled={completing || isComplete}
            className="w-full py-4 bg-white text-black font-bold rounded-xl text-[16px] disabled:opacity-60 flex items-center justify-center"
          >
            {completing
              ? <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              : isComplete ? 'Race completed 🎉' : 'Mark race complete'}
          </button>
        </div>
      </div>
    )
  }

  // ── Compact session card ──────────────────────────────────────────────────
  return (
    <>
      <div
        className="bg-white rounded-lg overflow-hidden"
        style={{ border: '1px solid #F3F4F6', borderLeft: `3px solid ${accentColor}` }}
      >
        {/* Card body */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }} aria-hidden>{emoji}</span>
              <div className="min-w-0">
                {isKeySession && !isComplete && (
                  <p className="text-[11px] font-semibold text-amber-500 leading-none mb-0.5">⭐ Key session</p>
                )}
                <span className={`text-[15px] font-semibold truncate block ${isComplete ? 'text-gray-400' : 'text-gray-900'}`}>
                  {session.title}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isComplete && <span className="text-green-500 text-[12px] font-bold">✓</span>}
              {session.duration_minutes && (
                <span className="text-[13px] text-gray-400">{session.duration_minutes}min</span>
              )}
            </div>
          </div>

          {detailParts.length > 0 && (
            <p className="text-[13px] text-gray-400 mt-0.5 ml-7">{detailParts.join(' · ')}</p>
          )}

          {coachNote && !isComplete && (
            <p className="text-[12px] text-gray-400 mt-0.5 ml-7 italic line-clamp-1">{coachNote}</p>
          )}
        </div>

        {/* Mark complete button */}
        {!isComplete && (
          <button
            onClick={markComplete}
            disabled={completing}
            className="w-full flex items-center justify-center gap-1.5 text-white text-[12px] font-semibold disabled:opacity-60"
            style={{ backgroundColor: accentColor, height: 36 }}
          >
            {completing
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : '✓ Mark complete'}
          </button>
        )}

        {/* Week celebration */}
        {isComplete && isWeekComplete && (
          <div className="px-4 pb-2.5 text-center">
            <p className="text-[12px] text-green-600 font-medium">🎉 Week complete!</p>
          </div>
        )}

        {/* View log link */}
        {isComplete && !isWeekComplete && !isRest && (
          <div className="px-4 pb-2.5">
            <button onClick={() => setShowLog(true)} className="text-[11px] text-gray-300 underline">
              View log
            </button>
          </div>
        )}
      </div>

      {showLog && <WorkoutLogModal session={session} onClose={handleLogClose} />}
    </>
  )
}
