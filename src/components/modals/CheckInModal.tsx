import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { format } from 'date-fns'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'
import type { Session, FeelingScore } from '../../types'

const FEELINGS: { score: FeelingScore; emoji: string; label: string }[] = [
  { score: 1, emoji: '😫', label: 'Terrible' },
  { score: 2, emoji: '😕', label: 'Poor' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '😊', label: 'Great' },
]

interface Props {
  todaySession?: Session
  onClose: () => void
}

export default function CheckInModal({ todaySession, onClose }: Props) {
  const queryClient = useQueryClient()
  const [feeling, setFeeling] = useState<FeelingScore | null>(null)
  const [soreness, setSoreness] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [coachResponse, setCoachResponse] = useState('')

  const today = format(new Date(), 'yyyy-MM-dd')

  async function submit() {
    if (!feeling) return
    setSubmitting(true)

    const { data: checkin } = await supabase
      .from('checkins')
      .insert({
        user_id: DEMO_USER_ID,
        session_id: todaySession?.id ?? null,
        checkin_date: today,
        feeling,
        soreness_notes: soreness || null,
      })
      .select()
      .single()

    if (checkin) {
      try {
        const res = await api.checkinResponse({
          userId: DEMO_USER_ID,
          checkinId: checkin.id,
          feeling,
          soreness_notes: soreness || undefined,
          todaySessionId: todaySession?.id,
        })
        setCoachResponse(res.coach_response)
        await supabase
          .from('checkins')
          .update({
            coach_response: res.coach_response,
            plan_adjusted: res.plan_adjusted,
            adjustment_details: res.adjustment_details ?? null,
          })
          .eq('id', checkin.id)
      } catch {
        setCoachResponse("Thanks for checking in. Get the session done and let me know how it goes.")
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['today-checkin'] })
    setSubmitting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <h3 className="font-bold text-lg">Morning check-in</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {coachResponse ? (
          <div className="px-5 pb-8">
            <div className="bg-gray-50 rounded-2xl p-4 mb-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Coach</div>
              <p className="text-sm text-gray-800 leading-relaxed">{coachResponse}</p>
            </div>
            <button onClick={onClose} className="w-full py-4 bg-black text-white font-semibold rounded-xl">
              Done
            </button>
          </div>
        ) : (
          <div className="px-5 pb-8 space-y-6">
            <div>
              <p className="font-semibold mb-4">How are you feeling today?</p>
              <div className="flex gap-2">
                {FEELINGS.map(({ score, emoji, label }) => (
                  <button
                    key={score}
                    onClick={() => setFeeling(score)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
                      feeling === score ? 'border-black bg-black' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{emoji}</span>
                    <span className={`text-[10px] font-medium ${feeling === score ? 'text-white' : 'text-gray-500'}`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                Any soreness or issues? (optional)
              </label>
              <textarea
                rows={2}
                placeholder="Tight calves, sore shoulders…"
                value={soreness}
                onChange={e => setSoreness(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl text-base resize-none"
              />
            </div>

            <button
              onClick={submit}
              disabled={!feeling || submitting}
              className="w-full py-4 bg-black text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {submitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : 'Check in'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
