import { useState, useRef } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import type { User } from '../../types'

interface Props {
  user: User
  onClose: () => void
}

export default function ProfileDrawer({ user, onClose }: Props) {
  const queryClient = useQueryClient()
  const [name, setName]           = useState(user.name)
  const [injuryNotes, setInjuryNotes] = useState(user.injury_notes ?? '')
  const [coachNote, setCoachNote]   = useState(user.coach_notes_freetext ?? '')
  const [saving, setSaving]         = useState(false)
  const [confirmRebuild, setConfirmRebuild] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const originalNote = useRef(user.coach_notes_freetext ?? '')

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
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 className="font-bold text-lg mb-3">Update your plan?</h3>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
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
          <h2 className="font-bold text-xl">Profile & Settings</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="px-5 py-6 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-base bg-white"
            />
          </div>

          {/* Injury notes */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Injury history</label>
            <textarea
              rows={2}
              placeholder="Any recurring injuries or areas to watch…"
              value={injuryNotes}
              onChange={e => setInjuryNotes(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>

          {/* Coach note */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Notes for your coach</label>
            <textarea
              rows={3}
              placeholder="Preferences, constraints, anything else your coach should know…"
              value={coachNote}
              onChange={e => setCoachNote(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
            />
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
              <p className="text-sm font-semibold text-amber-900 mb-1">Notes updated.</p>
              <p className="text-sm text-amber-700 mb-3">Would you like to rebuild your plan to reflect these changes?</p>
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
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl">
              <RefreshCw size={18} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm mb-0.5">Rebuild my plan</p>
                <p className="text-xs text-gray-500 mb-3">
                  Update your goal, fitness level, or training schedule and generate a fresh 12-week plan.
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
