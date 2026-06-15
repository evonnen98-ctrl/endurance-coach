import { useState, useRef } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import type { User, Goal } from '../../types'

interface Props {
  user: User
  onClose: () => void
}

const STYLE_LABEL: Record<string, string> = {
  conservative: 'Conservative',
  moderate:     'Moderate',
  aggressive:   'Aggressive',
}

const PHASE_LABEL: Record<string, string> = {
  race:     'Race prep',
  build:    'Building fitness',
  maintain: 'Maintenance',
  return:   'Return to training',
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[14px] text-gray-800">{value}</p>
    </div>
  )
}

export default function ProfileDrawer({ user, onClose }: Props) {
  const queryClient = useQueryClient()
  const [name, setName]               = useState(user.name)
  const [injuryNotes, setInjuryNotes] = useState(user.injury_notes ?? '')
  const [coachNote, setCoachNote]     = useState(user.coach_notes_freetext ?? '')
  const [saving, setSaving]           = useState(false)
  const [confirmRebuild, setConfirmRebuild] = useState(false)
  const [notesSaved, setNotesSaved]   = useState(false)
  const originalNote = useRef(user.coach_notes_freetext ?? '')

  const { data: goal } = useQuery({
    queryKey: ['active-goal'],
    queryFn: async () => {
      const { data } = await supabase
        .from('goals').select('*').eq('user_id', DEMO_USER_ID).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1).single()
      return data as Goal | null
    },
  })

  const prefs = (user.preferences ?? {}) as Record<string, unknown>
  const daysPerWeek    = prefs.training_days_per_week as number | undefined
  const selectedDays   = prefs.selected_days as string[] | undefined
  const weeklyRunKm    = prefs.current_weekly_run_km as number | undefined
  const weeklyRideKm   = prefs.current_weekly_ride_km as number | undefined
  const weeklySwimKm   = prefs.current_weekly_swim_km as number | undefined

  const goalLine = goal?.event_type
    ? [
        goal.event_type,
        goal.target_date
          ? format(parseISO(goal.target_date), 'd MMM yyyy')
          : null,
      ].filter(Boolean).join(' · ')
    : null

  const volumeLines = [
    weeklyRunKm  ? `Run ${weeklyRunKm}km/week`  : null,
    weeklyRideKm ? `Ride ${weeklyRideKm}km/week` : null,
    weeklySwimKm ? `Swim ${(weeklySwimKm * 1000).toFixed(0)}m/week` : null,
  ].filter(Boolean).join('  ·  ')

  async function save() {
    setSaving(true)
    const noteChanged = coachNote !== originalNote.current
    await supabase.from('users').update({
      name,
      injury_notes:         injuryNotes || null,
      coach_notes_freetext: coachNote || null,
      updated_at:           new Date().toISOString(),
    }).eq('id', DEMO_USER_ID)
    await queryClient.invalidateQueries({ queryKey: ['user'] })
    setSaving(false)
    if (noteChanged) {
      originalNote.current = coachNote
      setNotesSaved(true)
    } else {
      onClose()
    }
  }

  async function handleRebuild() {
    setConfirmRebuild(false)
    await supabase.from('users').update({ onboarding_complete: false }).eq('id', DEMO_USER_ID)
    await queryClient.refetchQueries({ queryKey: ['user'] })
    onClose()
  }

  if (confirmRebuild) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-2xl">
          <h3 className="font-semibold text-lg mb-3">Update your plan?</h3>
          <p className="text-[15px] text-gray-600 mb-6 leading-relaxed">
            This takes you back through setup so you can update your goal, fitness level, and training preferences.
            Your current plan will be replaced. Workout history and coach notes are kept.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmRebuild(false)}
              className="flex-1 py-3 border border-gray-200 font-semibold rounded-xl text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleRebuild}
              className="flex-1 py-3 bg-black text-white font-semibold rounded-xl"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-xl">Profile & Settings</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="px-5 py-6 space-y-6">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-[15px] bg-white"
            />
          </div>

          {/* ── What your coach knows ── */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 pt-4 pb-3 bg-gray-50 border-b border-gray-100">
              <h3 className="text-base font-semibold">What your coach knows about you</h3>
              <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                This is the information your coach uses to build and adjust your plan.
                Edit anything that changes.
              </p>
            </div>

            <div className="px-4 py-4 space-y-4">
              {/* Two-column grid for read-only info */}
              <div className="grid grid-cols-2 gap-3">
                {goalLine && <ReadOnlyField label="Goal" value={goalLine} />}
                <ReadOnlyField
                  label="Approach"
                  value={[
                    PHASE_LABEL[user.training_phase],
                    user.training_style ? STYLE_LABEL[user.training_style] : null,
                  ].filter(Boolean).join(' · ')}
                />
                {user.disciplines && user.disciplines.length > 0 && (
                  <ReadOnlyField
                    label="Disciplines"
                    value={user.disciplines.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}
                  />
                )}
                {(daysPerWeek || selectedDays?.length) && (
                  <ReadOnlyField
                    label="Training days"
                    value={[
                      daysPerWeek ? `${daysPerWeek}×/week` : null,
                      selectedDays?.length ? selectedDays.join(', ') : null,
                    ].filter(Boolean).join(' — ')}
                  />
                )}
              </div>
              {volumeLines && (
                <ReadOnlyField label="Current weekly volumes" value={volumeLines} />
              )}

              {/* Injury notes — editable */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Injury history
                </label>
                <textarea
                  rows={2}
                  placeholder="Any recurring injuries or areas to watch…"
                  value={injuryNotes}
                  onChange={e => setInjuryNotes(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-[15px] resize-none"
                />
              </div>

              {/* Coach notes — editable */}
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Your notes to your coach
                </label>
                <p className="text-[13px] text-gray-400 mb-2">
                  Preferences, constraints, anything else your coach should know
                </p>
                <textarea
                  rows={3}
                  placeholder="e.g. I travel for work on Fridays, I prefer not to run in the mornings…"
                  value={coachNote}
                  onChange={e => setCoachNote(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-[15px] resize-none"
                />
              </div>
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-3.5 bg-black text-white font-semibold rounded-xl disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          {notesSaved && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-[15px] font-semibold text-amber-900 mb-1">Notes updated.</p>
              <p className="text-[14px] text-amber-700 mb-3">Would you like to rebuild your plan to reflect these changes?</p>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-amber-300 text-amber-800 text-sm font-semibold rounded-xl"
                >
                  Not now
                </button>
                <button
                  onClick={() => setConfirmRebuild(true)}
                  className="flex-1 py-2.5 bg-amber-700 text-white text-sm font-semibold rounded-xl"
                >
                  Rebuild plan
                </button>
              </div>
            </div>
          )}

          {/* Rebuild plan */}
          <div className="border-t border-gray-100 pt-2">
            <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl">
              <RefreshCw size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-[15px] mb-0.5">Rebuild my plan</p>
                <p className="text-[13px] text-gray-500 mb-3">
                  Update your goal, fitness level, or training schedule and generate a new plan.
                </p>
                <button
                  onClick={() => setConfirmRebuild(true)}
                  className="w-full py-2.5 border-2 border-black text-black font-semibold rounded-xl text-sm hover:bg-black hover:text-white transition-colors"
                >
                  Update plan settings
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
