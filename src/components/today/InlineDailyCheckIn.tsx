import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'
import type { Session, FeelingScore } from '../../types'

const SCORES: FeelingScore[] = [1, 2, 3, 4, 5]
const SCORE_LABEL: Record<FeelingScore, string> = {
  1: 'Rough', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great',
}

interface Props {
  name: string
  todaySession?: Session
  nudgeOnly?: boolean
}

export default function InlineDailyCheckIn({ name, todaySession, nudgeOnly = false }: Props) {
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
        user_id:        DEMO_USER_ID,
        session_id:     todaySession?.id ?? null,
        checkin_date:   today,
        feeling,
        soreness_notes: soreness || null,
      })
      .select()
      .single()

    if (checkin) {
      try {
        const res = await api.checkinResponse({
          userId:         DEMO_USER_ID,
          checkinId:      checkin.id,
          feeling,
          soreness_notes: soreness || undefined,
          todaySessionId: todaySession?.id,
        })
        setCoachResponse(res.coach_response)
        await supabase
          .from('checkins')
          .update({
            coach_response:     res.coach_response,
            plan_adjusted:      res.plan_adjusted,
            adjustment_details: res.adjustment_details ?? null,
          })
          .eq('id', checkin.id)
      } catch {
        setCoachResponse("Thanks for checking in. Listen to your body and let me know how the session goes.")
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['today-checkin'] })
    await queryClient.invalidateQueries({ queryKey: ['user'] })
    setSubmitting(false)
  }

  // Coach response state
  if (coachResponse) {
    return (
      <div className="mx-4 bg-stone-50 border border-stone-100 rounded-2xl p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Coach</div>
        <p className="text-sm text-gray-800 leading-relaxed">{coachResponse}</p>
      </div>
    )
  }

  // 3-day nudge variant
  if (nudgeOnly) {
    return (
      <div className="mx-4 bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <p className="text-sm text-amber-800 font-medium mb-3">
          Haven't heard from you in a few days — how's training going?
        </p>
        <div className="flex gap-2">
          {SCORES.map(score => (
            <button
              key={score}
              onClick={() => setFeeling(score)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                feeling === score
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-amber-200 bg-white text-amber-700'
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        {feeling !== null && (
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full mt-3 py-3 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 text-sm"
          >
            {submitting
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Check in'}
          </button>
        )}
      </div>
    )
  }

  // Main check-in card
  return (
    <div className="mx-4 bg-stone-50 border border-stone-100 rounded-2xl p-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Morning check-in</p>
      <p className="text-lg font-bold text-gray-900 mb-4">Good morning, {name}. How are you feeling?</p>

      {/* Numbered pill scale */}
      <div className="flex gap-2 mb-1">
        {SCORES.map(score => (
          <button
            key={score}
            onClick={() => setFeeling(score)}
            className={`flex-1 py-3 rounded-xl border text-base font-bold transition-all ${
              feeling === score
                ? 'border-gray-800 bg-gray-900 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            {score}
          </button>
        ))}
      </div>
      <div className="flex justify-between px-0.5 mb-4">
        <span className="text-[10px] text-gray-400">Rough</span>
        <span className="text-[10px] text-gray-400">Great</span>
      </div>

      {feeling !== null && (
        <>
          <p className="text-xs text-gray-500 mb-1">
            {SCORE_LABEL[feeling]} — {feeling <= 2 ? 'take it easy today.' : feeling === 3 ? 'listen to your body.' : 'ready to train.'}
          </p>
          <textarea
            rows={2}
            placeholder="Any soreness or issues? (optional)"
            value={soreness}
            onChange={e => setSoreness(e.target.value)}
            className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 resize-none mb-3 mt-2"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 text-sm"
          >
            {submitting
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Check in'}
          </button>
        </>
      )}
    </div>
  )
}
