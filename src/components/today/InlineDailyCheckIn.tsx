import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'
import type { Session, FeelingScore } from '../../types'

const FEELINGS: { score: FeelingScore; emoji: string; label: string }[] = [
  { score: 1, emoji: '😴', label: 'Dead' },
  { score: 2, emoji: '😕', label: 'Poor' },
  { score: 3, emoji: '😐', label: 'Okay' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '💪', label: 'Great' },
]

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
        user_id:       DEMO_USER_ID,
        session_id:    todaySession?.id ?? null,
        checkin_date:  today,
        feeling,
        soreness_notes: soreness || null,
      })
      .select()
      .single()

    if (checkin) {
      try {
        const res = await api.checkinResponse({
          userId:        DEMO_USER_ID,
          checkinId:     checkin.id,
          feeling,
          soreness_notes: soreness || undefined,
          todaySessionId: todaySession?.id,
        })
        setCoachResponse(res.coach_response)
        await supabase
          .from('checkins')
          .update({
            coach_response:    res.coach_response,
            plan_adjusted:     res.plan_adjusted,
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

  if (coachResponse) {
    return (
      <div className="mx-4 bg-black text-white rounded-2xl p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">Coach</div>
        <p className="text-sm leading-relaxed">{coachResponse}</p>
      </div>
    )
  }

  if (nudgeOnly) {
    return (
      <div className="mx-4 bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <p className="text-sm text-amber-800 font-medium">Haven't heard from you in a few days — how's training going?</p>
        <div className="flex gap-2 mt-3">
          {FEELINGS.map(({ score, emoji }) => (
            <button
              key={score}
              onClick={() => setFeeling(score)}
              className={`flex-1 py-2 rounded-xl border-2 text-xl transition-all ${
                feeling === score ? 'border-amber-500 bg-amber-100' : 'border-amber-100 bg-white'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        {feeling !== null && (
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full mt-3 py-3 bg-amber-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : 'Check in'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mx-4 bg-black text-white rounded-2xl p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Morning check-in</p>
      <p className="text-lg font-bold mb-4">Good morning, {name}. How are you feeling?</p>

      <div className="flex gap-2 mb-4">
        {FEELINGS.map(({ score, emoji, label }) => (
          <button
            key={score}
            onClick={() => setFeeling(score)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all ${
              feeling === score
                ? 'border-white bg-white/10'
                : 'border-white/20 bg-white/5'
            }`}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-[10px] font-medium text-gray-300">{label}</span>
          </button>
        ))}
      </div>

      {feeling !== null && (
        <>
          <textarea
            rows={2}
            placeholder="Any soreness or issues? (optional)"
            value={soreness}
            onChange={e => setSoreness(e.target.value)}
            className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-gray-400 resize-none mb-3"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-3.5 bg-white text-black font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting
              ? <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              : 'Check in'}
          </button>
        </>
      )}
    </div>
  )
}
