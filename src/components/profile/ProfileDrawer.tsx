import { useState } from 'react'
import { X, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'
import { useQuery } from '@tanstack/react-query'
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

  // Strava
  const [importState, setImportState]   = useState<'idle' | 'loading' | 'done'>('idle')
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  const { data: stravaConn, refetch: refetchStrava } = useQuery({
    queryKey: ['strava-status'],
    queryFn: api.stravaStatus,
  })

  async function save() {
    setSaving(true)
    await supabase.from('users').update({
      name,
      injury_notes:         injuryNotes || null,
      coach_notes_freetext: coachNote || null,
      updated_at:           new Date().toISOString(),
    }).eq('id', DEMO_USER_ID)
    await queryClient.invalidateQueries({ queryKey: ['user'] })
    setSaving(false)
    onClose()
  }

  async function handleRebuild() {
    setConfirmRebuild(false)
    // Reset onboarding — App.tsx will show OnboardingFlow with existing data pre-filled
    await supabase.from('users').update({ onboarding_complete: false }).eq('id', DEMO_USER_ID)
    await queryClient.refetchQueries({ queryKey: ['user'] })
    onClose()
  }

  async function handleImport() {
    setImportState('loading')
    try {
      const result = await api.stravaImport(DEMO_USER_ID)
      setImportResult({ imported: result.imported, skipped: result.skipped })
      await queryClient.invalidateQueries({ queryKey: ['workout-logs'] })
      await queryClient.invalidateQueries({ queryKey: ['week-sessions'] })
    } catch {
      setImportResult(null)
    } finally {
      setImportState('done')
    }
  }

  async function handleDisconnect() {
    await api.stravaDisconnect()
    await refetchStrava()
    setImportState('idle')
    setImportResult(null)
  }

  // Confirm rebuild dialog
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

          {/* Strava */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#FC4C02">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Strava</span>
            </div>

            {stravaConn?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  {stravaConn.athlete_photo_url && (
                    <img src={stravaConn.athlete_photo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{stravaConn.athlete_name}</p>
                    <p className="text-xs text-green-600 font-medium">Connected</p>
                  </div>
                </div>
                {importState === 'done' && importResult && (
                  <p className="text-xs text-gray-500 text-center">
                    Imported {importResult.imported} activities{importResult.skipped > 0 ? `, ${importResult.skipped} already synced` : ''}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={importState === 'loading'}
                    className="flex-1 py-2.5 bg-[#FC4C02] text-white text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {importState === 'loading'
                      ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing…</>
                      : 'Import activities'}
                  </button>
                  <button onClick={handleDisconnect} className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl">
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <a
                href="/api/strava/auth"
                className="flex items-center justify-center gap-2 w-full py-3 bg-[#FC4C02] text-white font-semibold rounded-xl text-sm"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                Connect Strava
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
