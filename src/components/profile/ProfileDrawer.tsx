import { useState, useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'
import type { User, Discipline, TrainingStyle, Goal } from '../../types'

interface Props {
  user: User
  onClose: () => void
}

const DISCIPLINES: Discipline[] = ['swim', 'ride', 'run']
const STYLES: TrainingStyle[] = ['conservative', 'moderate', 'aggressive']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
      {children}
    </label>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full p-3 border border-gray-200 rounded-xl text-base bg-white ${props.className ?? ''}`}
    />
  )
}

export default function ProfileDrawer({ user, onClose }: Props) {
  const queryClient = useQueryClient()

  // ── Profile fields ─────────────────────────────────────────────────────────
  const [name,        setName]        = useState(user.name)
  const [disciplines, setDisciplines] = useState<Discipline[]>(user.disciplines)
  const [style,       setStyle]       = useState<TrainingStyle>(user.training_style)
  const [ftp,         setFtp]         = useState(user.ftp?.toString() ?? '')
  const [swimPref,    setSwimPref]    = useState(user.swim_pool_or_open ?? 'pool')
  const [injuryNotes, setInjuryNotes] = useState(user.injury_notes ?? '')
  const [coachNote,   setCoachNote]   = useState(user.coach_notes_freetext ?? '')
  const [saving,      setSaving]      = useState(false)

  // ── Training profile fields (for rebuild) ──────────────────────────────────
  const prefs = (user.preferences ?? {}) as Record<string, string | number>
  const [eventType,        setEventType]        = useState('')
  const [targetDate,       setTargetDate]        = useState('')
  const [runWeeklyKm,      setRunWeeklyKm]       = useState(prefs.run_weekly_km?.toString() ?? '')
  const [runPace,          setRunPace]           = useState((prefs.run_pace_easy as string) ?? '')
  const [rideWeeklyKm,     setRideWeeklyKm]      = useState(prefs.ride_weekly_km?.toString() ?? '')
  const [rideSpeed,        setRideSpeed]         = useState(prefs.ride_speed_kmh?.toString() ?? '')
  const [swimPace100m,     setSwimPace100m]      = useState((prefs.swim_pace_per_100m as string) ?? '')
  const [swimSessionDist,  setSwimSessionDist]   = useState(prefs.swim_session_distance_m?.toString() ?? '')

  // ── Rebuild state ──────────────────────────────────────────────────────────
  const [confirmRebuild, setConfirmRebuild] = useState(false)
  const [rebuilding,     setRebuilding]     = useState(false)
  const [buildMessage,   setBuildMessage]   = useState('Rebuilding your plan…')

  // ── Strava ────────────────────────────────────────────────────────────────
  const [importState,  setImportState]  = useState<'idle' | 'loading' | 'done'>('idle')
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)

  const { data: stravaConn, refetch: refetchStrava } = useQuery({
    queryKey: ['strava-status'],
    queryFn: api.stravaStatus,
  })

  const { data: goal } = useQuery<Goal | null>({
    queryKey: ['active-goal'],
    queryFn: async () => {
      const { data } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as Goal | null
    },
  })

  useEffect(() => {
    if (goal) {
      setEventType(goal.event_type ?? '')
      setTargetDate(goal.target_date ?? '')
    }
  }, [goal])

  const toggleDiscipline = (d: Discipline) => {
    setDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function save() {
    setSaving(true)
    await supabase.from('users').update({
      name,
      disciplines,
      training_style: style,
      ftp:              ftp ? parseInt(ftp) : null,
      swim_pool_or_open: swimPref,
      injury_notes:     injuryNotes || null,
      coach_notes_freetext: coachNote || null,
      updated_at:       new Date().toISOString(),
    }).eq('id', DEMO_USER_ID)
    await queryClient.invalidateQueries({ queryKey: ['user'] })
    setSaving(false)
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

  async function rebuildPlan() {
    setConfirmRebuild(false)
    setRebuilding(true)
    setBuildMessage('Archiving your current plan…')

    // 1. Archive all active plans
    await supabase
      .from('training_plans')
      .update({ status: 'archived' })
      .eq('user_id', DEMO_USER_ID)
      .eq('status', 'active')

    // 2. Save updated preferences + profile
    const updatedPrefs: Record<string, string | number> = {
      ...(user.preferences as Record<string, string | number> ?? {}),
    }
    if (runWeeklyKm)     updatedPrefs.run_weekly_km          = parseFloat(runWeeklyKm)
    if (runPace)         updatedPrefs.run_pace_easy          = runPace
    if (rideWeeklyKm)    updatedPrefs.ride_weekly_km         = parseFloat(rideWeeklyKm)
    if (rideSpeed)       updatedPrefs.ride_speed_kmh         = parseFloat(rideSpeed)
    if (swimPace100m)    updatedPrefs.swim_pace_per_100m     = swimPace100m
    if (swimSessionDist) updatedPrefs.swim_session_distance_m = parseFloat(swimSessionDist)

    await supabase.from('users').update({
      disciplines,
      preferences: updatedPrefs,
      updated_at:  new Date().toISOString(),
    }).eq('id', DEMO_USER_ID)

    // 3. Update goal
    await supabase.from('goals').upsert({
      id:          '00000000-0000-0000-0000-000000000002',
      user_id:     DEMO_USER_ID,
      event_type:  eventType || null,
      target_date: targetDate || null,
      status:      'active',
    })

    // 4. Generate new plan via SSE
    setBuildMessage('Building your revised 12-week plan…')
    await new Promise<void>((resolve) => {
      const es = new EventSource(`/api/ai/generate-plan-stream?userId=${encodeURIComponent(DEMO_USER_ID)}`)
      const maxWait = setTimeout(() => { es.close(); resolve() }, 25_000)
      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { type: string; message?: string }
          if (msg.type === 'status' && msg.message) setBuildMessage(msg.message)
          if (msg.type === 'done' || msg.type === 'error') {
            clearTimeout(maxWait)
            es.close()
            resolve()
          }
        } catch {}
      }
      es.onerror = () => { clearTimeout(maxWait); es.close(); resolve() }
    })

    // 5. Refresh all data and close
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user'] }),
      queryClient.invalidateQueries({ queryKey: ['active-goal'] }),
      queryClient.invalidateQueries({ queryKey: ['all-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['week-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['today-session'] }),
      queryClient.invalidateQueries({ queryKey: ['latest-coach-note'] }),
    ])

    setRebuilding(false)
    onClose()
  }

  // ── Full-screen rebuild overlay ────────────────────────────────────────────
  if (rebuilding) {
    return (
      <div className="fixed inset-0 bg-white z-[60] flex flex-col items-center justify-center gap-10 px-8">
        <div className="w-12 h-12 border-2 border-black border-t-transparent rounded-full animate-spin" />
        <div className="text-center max-w-xs">
          <h2 className="text-2xl font-bold mb-3">Rebuilding your plan</h2>
          <p className="text-gray-500 text-sm">{buildMessage}</p>
        </div>
      </div>
    )
  }

  // ── Confirm dialog ─────────────────────────────────────────────────────────
  if (confirmRebuild) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
            <h3 className="font-bold text-lg">Replace your current plan?</h3>
          </div>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            This will archive your current 12-week plan and generate a new one based on your updated profile.
            Your workout history and coach notes are preserved.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmRebuild(false)}
              className="flex-1 py-3 border border-gray-200 font-semibold rounded-xl text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={rebuildPlan}
              className="flex-1 py-3 bg-black text-white font-semibold rounded-xl"
            >
              Rebuild plan
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

        <div className="px-5 py-6 space-y-6">

          {/* ── General profile ─────────────────────────────────────────── */}
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <Label>Disciplines</Label>
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

          <div>
            <Label>Training style</Label>
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

          {disciplines.includes('ride') && (
            <div>
              <Label>FTP (watts)</Label>
              <Input
                type="number"
                value={ftp}
                onChange={e => setFtp(e.target.value)}
                placeholder="e.g. 240"
              />
            </div>
          )}

          {disciplines.includes('swim') && (
            <div>
              <Label>Swim environment</Label>
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

          <div>
            <Label>Injury history</Label>
            <textarea
              rows={2}
              placeholder="Any recurring injuries or areas to watch…"
              value={injuryNotes}
              onChange={e => setInjuryNotes(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>

          <div>
            <Label>Notes for your coach</Label>
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

          {/* ── Your Training Profile ────────────────────────────────────── */}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="font-bold text-base mb-1">Your Training Profile</h3>
            <p className="text-sm text-gray-500 mb-5">
              Update your current fitness and goal — then rebuild your plan to reflect where you are now.
            </p>

            {/* Goal */}
            <div className="space-y-4 mb-5">
              <div>
                <Label>Goal event</Label>
                <Input
                  type="text"
                  value={eventType}
                  onChange={e => setEventType(e.target.value)}
                  placeholder={goal?.event_type ?? 'e.g. Half Ironman, Marathon'}
                />
              </div>
              <div>
                <Label>Target race date</Label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                />
              </div>
            </div>

            {/* Per-discipline stats */}
            {disciplines.includes('run') && (
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-3">Running</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Weekly km</Label>
                    <Input
                      type="number"
                      placeholder={prefs.run_weekly_km?.toString() ?? '40'}
                      value={runWeeklyKm}
                      onChange={e => setRunWeeklyKm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Easy pace (min/km)</Label>
                    <Input
                      type="text"
                      placeholder={prefs.run_pace_easy?.toString() ?? '5:30'}
                      value={runPace}
                      onChange={e => setRunPace(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {disciplines.includes('ride') && (
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-3">Cycling</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Weekly km</Label>
                    <Input
                      type="number"
                      placeholder={prefs.ride_weekly_km?.toString() ?? '120'}
                      value={rideWeeklyKm}
                      onChange={e => setRideWeeklyKm(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Avg speed (km/h)</Label>
                    <Input
                      type="number"
                      placeholder={prefs.ride_speed_kmh?.toString() ?? '28'}
                      value={rideSpeed}
                      onChange={e => setRideSpeed(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {disciplines.includes('swim') && (
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50 mb-3">
                <p className="text-xs font-semibold text-gray-600 mb-3">Swimming</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>100m pace (min:sec)</Label>
                    <Input
                      type="text"
                      placeholder={prefs.swim_pace_per_100m?.toString() ?? '1:45'}
                      value={swimPace100m}
                      onChange={e => setSwimPace100m(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Typical session (m)</Label>
                    <Input
                      type="number"
                      placeholder={prefs.swim_session_distance_m?.toString() ?? '2000'}
                      value={swimSessionDist}
                      onChange={e => setSwimSessionDist(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rebuild button */}
            <div className="mt-5 p-4 border border-gray-200 rounded-xl bg-white">
              <p className="text-sm font-semibold mb-1">Rebuild my plan</p>
              <p className="text-xs text-gray-500 mb-4">
                Generates a new 12-week plan from your updated profile. Your history and coach notes are kept.
              </p>
              <button
                onClick={() => setConfirmRebuild(true)}
                className="w-full py-3 border-2 border-black text-black font-semibold rounded-xl text-sm hover:bg-black hover:text-white transition-colors"
              >
                Rebuild my plan
              </button>
            </div>
          </div>

          {/* ── Strava ─────────────────────────────────────────────────── */}
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
                    <p className="text-sm font-semibold text-gray-900 truncate">{stravaConn.athlete_name}</p>
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

        </div>
      </div>
    </div>
  )
}
