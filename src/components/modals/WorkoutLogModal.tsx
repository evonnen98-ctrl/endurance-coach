import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'
import type { Session } from '../../types'

interface Props {
  session: Session
  onClose: () => void
}

const STARS = [1, 2, 3, 4, 5]

export default function WorkoutLogModal({ session, onClose }: Props) {
  const queryClient = useQueryClient()
  const [distance, setDistance] = useState(session.distance_km?.toString() ?? '')
  const [duration, setDuration] = useState(session.duration_minutes?.toString() ?? '')
  const [pace, setPace] = useState(session.target_pace ?? '')
  const [rpe, setRpe] = useState(7)
  const [note, setNote] = useState('')
  const [hr, setHr] = useState('')
  const [injuryFlag, setInjuryFlag] = useState(false)
  const [conditions, setConditions] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [coachResponse, setCoachResponse] = useState('')
  const [logId, setLogId] = useState<string | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [ratingSaved, setRatingSaved] = useState(false)

  const isRest = session.discipline === 'rest'

  async function saveRating(stars: number) {
    if (!logId) return
    setRating(stars)
    const { data: existing } = await supabase
      .from('workout_logs')
      .select('raw_data')
      .eq('id', logId)
      .single()
    const raw = (existing?.raw_data as Record<string, unknown>) ?? {}
    await supabase.from('workout_logs').update({ raw_data: { ...raw, rating: stars } }).eq('id', logId)
    setRatingSaved(true)
  }

  async function submit() {
    setSubmitting(true)

    const { data: log } = await supabase
      .from('workout_logs')
      .insert({
        session_id:             session.id,
        user_id:                DEMO_USER_ID,
        actual_distance_km:     distance ? parseFloat(distance) : null,
        actual_duration_minutes: duration ? parseInt(duration) : null,
        actual_pace:            pace || null,
        rpe,
        user_note:              note || null,
        average_hr:             hr ? parseInt(hr) : null,
        injury_flag:            injuryFlag,
        conditions_notes:       conditions || null,
        source:                 'manual',
      })
      .select()
      .single()

    await supabase.from('sessions').update({ status: 'complete' }).eq('id', session.id)

    if (log) {
      setLogId(log.id)
      try {
        const res = await api.postWorkout({
          userId:                 DEMO_USER_ID,
          workoutLogId:           log.id,
          sessionId:              session.id,
          rpe,
          user_note:              note || undefined,
          actual_distance_km:     distance ? parseFloat(distance) : undefined,
          actual_duration_minutes: duration ? parseInt(duration) : undefined,
        })
        setCoachResponse(res.coach_response)
        await supabase
          .from('workout_logs')
          .update({ coach_response: res.coach_response })
          .eq('id', log.id)
      } catch {
        setCoachResponse("Good work completing that session. I'll factor this into your upcoming sessions.")
      }

      // Trigger auto-adjust in background (#4)
      api.autoAdjust(DEMO_USER_ID).then(result => {
        if (result.adjusted) {
          queryClient.invalidateQueries({ queryKey: ['user'] })
        }
      }).catch(() => {})
    }

    await queryClient.invalidateQueries({ queryKey: ['today-session'] })
    await queryClient.invalidateQueries({ queryKey: ['week-sessions'] })
    await queryClient.invalidateQueries({ queryKey: ['workout-logs'] })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="font-bold text-lg">Log workout</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {coachResponse ? (
          <div className="px-5 pb-8 space-y-4">
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Coach</div>
              <p className="text-sm text-gray-800 leading-relaxed">{coachResponse}</p>
            </div>

            {/* Session rating (#12) */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Rate this session</p>
              <div className="flex gap-2">
                {STARS.map(s => (
                  <button
                    key={s}
                    onClick={() => saveRating(s)}
                    className="flex-1 py-3 text-2xl rounded-xl border-2 transition-all"
                    style={rating !== null && s <= rating
                      ? { backgroundColor: 'var(--mist)', borderColor: 'var(--ink)' }
                      : { backgroundColor: '#F9FAFB', borderColor: '#F3F4F6' }}
                  >
                    {rating !== null && s <= rating ? '★' : '☆'}
                  </button>
                ))}
              </div>
              {ratingSaved && <p className="text-xs text-gray-400 mt-1.5 text-center">Rating saved</p>}
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 font-semibold rounded-xl"
              style={{ backgroundColor: 'var(--volt)', color: 'var(--ink)' }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="px-5 pb-8 space-y-4">
            <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500">
              Pre-filled from: <span className="font-medium text-gray-700">{session.title}</span>
            </div>

            {!isRest && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Distance (km)</label>
                    <input
                      type="number"
                      value={distance}
                      onChange={e => setDistance(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-base"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Duration (min)</label>
                    <input
                      type="number"
                      value={duration}
                      onChange={e => setDuration(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-base"
                    />
                  </div>
                </div>

                {(session.discipline === 'run' || session.discipline === 'swim' || session.discipline === 'ride') && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                      {session.discipline === 'swim' ? 'Avg pace (per 100m)' : session.discipline === 'ride' ? 'Avg speed (km/h)' : 'Avg pace (per km)'}
                    </label>
                    <input
                      type="text"
                      value={pace}
                      onChange={e => setPace(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-xl text-base"
                      placeholder={session.discipline === 'swim' ? '1:45' : session.discipline === 'ride' ? '32' : '5:20'}
                    />
                  </div>
                )}
              </>
            )}

            {/* RPE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Effort (RPE)</label>
                <span className="font-bold text-lg">{rpe}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={rpe}
                onChange={e => setRpe(parseInt(e.target.value))}
                className="w-full"
                style={{ accentColor: 'var(--volt)' }}
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Easy</span>
                <span>All out</span>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">How did it go?</label>
              <textarea
                rows={3}
                placeholder="Tell your coach how the session felt…"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-base resize-none"
              />
            </div>

            <button
              className="text-sm text-gray-400 underline"
              onClick={() => setShowOptional(s => !s)}
            >
              {showOptional ? 'Hide' : 'Show'} optional fields
            </button>

            {showOptional && (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Average HR (bpm)</label>
                  <input
                    type="number"
                    value={hr}
                    onChange={e => setHr(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Conditions / notes</label>
                  <input
                    type="text"
                    value={conditions}
                    onChange={e => setConditions(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-base"
                    placeholder="Hot, windy, tired legs…"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={injuryFlag}
                    onChange={e => setInjuryFlag(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Flag an injury or pain point</span>
                </label>
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full py-4 font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: 'var(--volt)', color: 'var(--ink)' }}
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1a2400', borderTopColor: 'transparent' }} />
              ) : 'Save workout'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
