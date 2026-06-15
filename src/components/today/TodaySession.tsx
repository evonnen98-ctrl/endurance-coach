import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Session, Checkin } from '../../types'
import { disciplineBg, disciplineLabel, disciplineColor } from '../../lib/discipline'
import WorkoutLogModal from '../modals/WorkoutLogModal'

interface Props {
  session: Session
  checkin?: Checkin
  weekSessions?: Session[]
}

const COMPLETION_ACKS: Record<string, string> = {
  easy:     'Solid base work. Keep tonight easy — your body is building right now.',
  long:     'Good long session. Feet up tonight — you\'ve earned it.',
  tempo:    'Strong tempo. Make sure tomorrow is genuinely easy.',
  interval: 'Intervals done. Adaptations happen in recovery — rest up.',
  speed:    'Speed work complete. Take the next 24 hours easy.',
  base:     'Solid base session. Consistent easy work builds everything else.',
  drill:    'Technique work done. Those habits compound over time.',
  brick:    'Brick complete. Your legs learned something today.',
  recovery: 'Good recovery session. Tomorrow\'s session awaits.',
  rest:     'Rest day logged. This is part of the plan.',
}

const DISCIPLINE_EMOJI: Record<string, string> = {
  swim: '🏊', ride: '🚴', run: '🏃', brick: '🏊', rest: '😴',
}

const BUTTON_COLOR: Record<string, string> = {
  swim: '#3B82F6', ride: '#F97316', run: '#22C55E',
  brick: '#F97316', rest: '#9CA3AF',
}

export default function TodaySession({ session, checkin, weekSessions = [] }: Props) {
  const queryClient = useQueryClient()
  const [showLog, setShowLog] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)

  const isComplete = session.status === 'complete' || justCompleted
  const isRest     = session.discipline === 'rest'
  const isRaceDay  = session.session_type === 'race'

  const completedThisWeek = weekSessions.filter(s => s.status === 'complete' || (s.id === session.id && justCompleted)).length
  const totalThisWeek     = weekSessions.filter(s => s.discipline !== 'rest').length
  const isWeekComplete    = completedThisWeek === totalThisWeek && totalThisWeek > 0

  const ack        = COMPLETION_ACKS[session.session_type] ?? COMPLETION_ACKS.rest
  const tagClass   = disciplineBg[session.discipline]
  const accentColor = BUTTON_COLOR[session.discipline] ?? '#9CA3AF'
  const emoji       = DISCIPLINE_EMOJI[session.discipline] ?? '🏃'

  const detailParts = [
    session.distance_km   ? `${session.distance_km}km`       : null,
    session.target_pace   ? session.target_pace               : null,
    session.effort_zone   ? session.effort_zone               : null,
    session.duration_minutes ? `${session.duration_minutes}min` : null,
  ].filter(Boolean)

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

  // ── Race day ──────────────────────────────────────────────────────────────
  if (isRaceDay) {
    return (
      <div className="mx-6 bg-gradient-to-br from-black to-gray-900 rounded-2xl overflow-hidden shadow-lg">
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
            {completing ? (
              <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : isComplete ? 'Race completed 🎉' : 'Mark race complete'}
          </button>
        </div>
      </div>
    )
  }

  // ── Normal session ────────────────────────────────────────────────────────
  return (
    <>
      <div
        className="mx-6 bg-white rounded-2xl shadow-sm overflow-hidden"
        style={{ border: '1px solid #F3F4F6', borderLeft: `4px solid ${accentColor}` }}
      >
        {/* Main body */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Discipline emoji */}
            <span
              className="flex-shrink-0 leading-none mt-0.5"
              style={{ fontSize: 32 }}
              aria-hidden
            >
              {emoji}
            </span>

            {/* Text block */}
            <div className="flex-1 min-w-0">
              <div className="mb-1">
                <span className={`text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${tagClass}`}>
                  {disciplineLabel[session.discipline]}
                </span>
              </div>
              <h2 className="text-[20px] font-bold text-gray-900 leading-tight">
                {session.title}
              </h2>
              {!isRest && detailParts.length > 0 && (
                <p className="text-[14px] text-gray-400 mt-1">
                  {detailParts.join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* Coach rationale / check-in response */}
          {coachNote && (
            <div
              className="mt-4 px-3.5 py-3 rounded-xl text-[13px] leading-relaxed"
              style={{
                backgroundColor: checkin?.plan_adjusted ? '#FFFBEB' : '#F9FAFB',
                color: checkin?.plan_adjusted ? '#92400E' : '#6B7280',
              }}
            >
              <span className="font-semibold not-italic" style={{ color: checkin?.plan_adjusted ? '#B45309' : '#374151' }}>
                Coach:{' '}
              </span>
              <span className="italic">{coachNote}</span>
            </div>
          )}
        </div>

        {/* CTA area */}
        {!isComplete && (
          <div className="px-6 pb-6 space-y-2">
            <button
              onClick={markComplete}
              disabled={completing}
              className="w-full py-4 text-white font-bold rounded-xl text-[16px] disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity"
              style={{ backgroundColor: accentColor }}
            >
              {completing ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>✓</span>
                  <span>Mark complete</span>
                </>
              )}
            </button>
            {!isRest && (
              <button
                onClick={() => setShowLog(true)}
                className="w-full py-2 text-[13px] font-medium text-gray-400 text-center"
              >
                Log details instead
              </button>
            )}
          </div>
        )}

        {/* Completion state */}
        {isComplete && (
          <div className="px-6 pb-6">
            {isWeekComplete ? (
              <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#F0FDF4' }}>
                <p className="text-2xl mb-1">🎉</p>
                <p className="font-bold text-green-800 text-sm">Week complete!</p>
                <p className="text-xs text-green-700 mt-1">
                  {totalThisWeek} of {totalThisWeek} sessions done this week.
                </p>
                <p className="text-xs text-green-600 mt-1.5 italic">{ack}</p>
              </div>
            ) : (
              <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#F9FAFB' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs">✓</span>
                  <span className="text-sm font-semibold text-gray-800">
                    {completedThisWeek} session{completedThisWeek !== 1 ? 's' : ''} complete this week
                  </span>
                </div>
                <p className="text-xs text-gray-500 italic ml-7">{ack}</p>
                {!isRest && (
                  <button
                    onClick={() => setShowLog(true)}
                    className="mt-2 ml-7 text-xs text-gray-400 underline"
                  >
                    View log
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showLog && (
        <WorkoutLogModal session={session} onClose={handleLogClose} />
      )}
    </>
  )
}
