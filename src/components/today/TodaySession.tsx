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

  const ack = COMPLETION_ACKS[session.session_type] ?? COMPLETION_ACKS.rest

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

  const tagClass   = disciplineBg[session.discipline]

  const leftBorderColor: Record<string, string> = {
    swim: '#3B82F6', ride: '#F97316', run: '#22C55E',
    rest: '#9CA3AF', brick: '#F97316',
  }
  const accentColor = leftBorderColor[session.discipline] ?? '#9CA3AF'

  // Race day: special celebratory card
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
        <div className="px-4 pb-4">
          <button
            onClick={markComplete}
            disabled={completing || isComplete}
            className="w-full py-3.5 bg-white text-black font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {completing ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : isComplete ? (
              <span>Race completed 🎉</span>
            ) : (
              <span>Mark race complete</span>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="mx-6 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        style={{ borderLeft: `4px solid ${accentColor}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className={`text-xs font-medium uppercase tracking-wider px-2.5 py-1 rounded-full ${tagClass}`}>
            {disciplineLabel[session.discipline]}
          </span>
          <span className="text-[13px] text-gray-500">
            {session.duration_minutes ? `${session.duration_minutes}min` : '—'}
          </span>
        </div>

        {/* Title */}
        <div className="px-4 pb-3">
          <h2 className="text-[18px] font-semibold leading-snug">{session.title}</h2>
          {session.description && (
            <p className="text-[14px] text-gray-500 mt-1 leading-relaxed">{session.description}</p>
          )}
        </div>

        {/* Checkin response or coaching rationale */}
        {checkin?.coach_response ? (
          <div className={`mx-4 mb-4 px-3 py-2.5 rounded-lg text-[14px] ${
            checkin.plan_adjusted ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-600'
          }`}>
            <span className="font-medium">Coach: </span>{checkin.coach_response}
          </div>
        ) : session.coaching_rationale ? (
          <div className="mx-4 mb-4 px-3 py-2.5 bg-gray-50 rounded-lg text-[14px] text-gray-500 italic">
            <span className="font-medium not-italic">Coach: </span>{session.coaching_rationale}
          </div>
        ) : null}

        {/* Targets row */}
        {!isRest && (session.target_pace || session.effort_zone || session.distance_km) && (
          <div className="flex gap-2 px-4 mb-4 flex-wrap">
            {session.distance_km && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                {session.distance_km}km
              </span>
            )}
            {session.target_pace && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                {session.target_pace}
              </span>
            )}
            {session.effort_zone && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                {session.effort_zone}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        {!isComplete && (
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={markComplete}
              disabled={completing}
              className="flex-1 py-3.5 bg-black text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {completing ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                className="px-4 py-3.5 border border-gray-200 font-semibold rounded-xl text-sm"
              >
                Log
              </button>
            )}
          </div>
        )}

        {/* Completion moment (#6) */}
        {isComplete && (
          <div className="px-4 pb-4">
            {isWeekComplete ? (
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl mb-1">🎉</p>
                <p className="font-bold text-green-800 text-sm">Week complete!</p>
                <p className="text-xs text-green-700 mt-1">
                  {totalThisWeek} of {totalThisWeek} sessions done this week.
                </p>
                <p className="text-xs text-green-600 mt-1.5 italic">{ack}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl px-4 py-3">
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
        <WorkoutLogModal
          session={session}
          onClose={handleLogClose}
        />
      )}
    </>
  )
}
