import { useState } from 'react'
import { X } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'
import type { User, Discipline, TrainingStyle } from '../../types'

interface Props {
  user: User
  onClose: () => void
}

const DISCIPLINES: Discipline[] = ['swim', 'ride', 'run']
const STYLES: TrainingStyle[] = ['conservative', 'moderate', 'aggressive']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ProfileDrawer({ user, onClose }: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name)
  const [importState, setImportState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  const { data: stravaConn, refetch: refetchStrava } = useQuery({
    queryKey: ['strava-status'],
    queryFn: api.stravaStatus,
  })
  const [disciplines, setDisciplines] = useState<Discipline[]>(user.disciplines)
  const [style, setStyle] = useState<TrainingStyle>(user.training_style)
  const [ftp, setFtp] = useState(user.ftp?.toString() ?? '')
  const [swimPref, setSwimPref] = useState(user.swim_pool_or_open ?? 'pool')
  const [injuryNotes, setInjuryNotes] = useState(user.injury_notes ?? '')
  const [coachNote, setCoachNote] = useState(user.coach_notes_freetext ?? '')
  const [saving, setSaving] = useState(false)

  const toggleDiscipline = (d: Discipline) => {
    setDisciplines(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
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

  async function save() {
    setSaving(true)
    await supabase.from('users').update({
      name,
      disciplines,
      training_style: style,
      ftp: ftp ? parseInt(ftp) : null,
      swim_pool_or_open: swimPref,
      injury_notes: injuryNotes || null,
      coach_notes_freetext: coachNote || null,
      updated_at: new Date().toISOString(),
    }).eq('id', DEMO_USER_ID)
    await queryClient.invalidateQueries({ queryKey: ['user'] })
    setSaving(false)
    onClose()
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

        <div className="px-5 py-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-base"
            />
          </div>

          {/* Disciplines */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Disciplines</label>
            <div className="flex gap-2">
              {DISCIPLINES.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDiscipline(d)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                    disciplines.includes(d)
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Training style */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Training style</label>
            <div className="flex gap-2">
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-medium capitalize transition-all ${
                    style === s ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* FTP */}
          {disciplines.includes('ride') && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                FTP (watts)
              </label>
              <input
                type="number"
                value={ftp}
                onChange={e => setFtp(e.target.value)}
                placeholder="e.g. 240"
                className="w-full p-3 border border-gray-200 rounded-xl text-base"
              />
            </div>
          )}

          {/* Swim preference */}
          {disciplines.includes('swim') && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Swim environment
              </label>
              <div className="flex gap-2">
                {['pool', 'open water'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSwimPref(opt)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-medium capitalize transition-all ${
                      swimPref === opt ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Injury history */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Injury history
            </label>
            <textarea
              rows={2}
              placeholder="Any recurring injuries or areas to watch…"
              value={injuryNotes}
              onChange={e => setInjuryNotes(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>

          {/* Coach notes */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Notes for your coach
            </label>
            <textarea
              rows={3}
              placeholder="Preferences, constraints, anything else your coach should know…"
              value={coachNote}
              onChange={e => setCoachNote(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>

          {/* ── Strava ─────────────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center gap-2 mb-1">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#FC4C02">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Strava</span>
            </div>
            {!stravaConn?.connected && (
              <p className="text-sm text-gray-500 mb-4">
                Connect Strava to track your sessions automatically and help your coach adjust your plan based on real data.
              </p>
            )}

            {stravaConn?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  {stravaConn.athlete_photo_url && (
                    <img
                      src={stravaConn.athlete_photo_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {stravaConn.athlete_name}
                    </p>
                    <p className="text-xs text-green-600 font-medium">Connected</p>
                  </div>
                </div>

                {importState === 'done' && importResult && (
                  <p className="text-xs text-gray-500 text-center">
                    Imported {importResult.imported} activities
                    {importResult.skipped > 0 ? `, ${importResult.skipped} already synced` : ''}
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
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl"
                  >
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

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
