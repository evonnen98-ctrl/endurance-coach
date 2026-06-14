import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import type { Discipline, TrainingPhase } from '../../types'
import type { User } from '../../types'
import Step1DisciplinesPhase from './Step1DisciplinesPhase'
import Step2GoalStats from './Step2GoalStats'
import BuildingPlan from './BuildingPlan'

interface Props {
  existingUser: User | null
}

interface OnboardingData {
  disciplines: Discipline[]
  phase: TrainingPhase
  eventType: string
  targetDate: string
  stats: Record<string, string>
  coachNote: string
}

// Poll /api/health until it responds OK, or until maxMs elapses.
// This absorbs Railway cold-start delays on the loading screen
// instead of letting them freeze the SSE connection silently.
async function waitForServer(maxMs = 55_000): Promise<void> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch('/api/health', {
        signal: AbortSignal.timeout(5_000),
      })
      if (r.ok) return
    } catch {
      // server not ready yet — wait 1s and retry
    }
    await new Promise(r => setTimeout(r, 1_000))
  }
}

export default function OnboardingFlow({ existingUser }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [building, setBuilding] = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)
  const [data, setData] = useState<Partial<OnboardingData>>({
    disciplines: existingUser?.disciplines ?? [],
  })

  function next(patch: Partial<OnboardingData>) {
    setData(prev => ({ ...prev, ...patch }))
    setStep(s => s + 1)
    // Ping server on every step transition — gives cold container more warm-up time
    fetch('/api/health').catch(() => {})
  }

  function back() {
    setStep(s => s - 1)
  }

  async function finish(patch: { eventType: string; targetDate: string; stats: Record<string, string>; coachNote: string }) {
    const final = { ...data, ...patch } as OnboardingData

    // Show loading screen immediately
    setBuildMessage('Connecting to your coach…')
    setBuilding(true)

    const preferences: Record<string, string | number> = {}
    if (final.stats?.run_weekly_km)  preferences.run_weekly_km          = parseFloat(final.stats.run_weekly_km)
    if (final.stats?.run_pace)       preferences.run_pace_easy          = final.stats.run_pace
    if (final.stats?.ride_weekly_km) preferences.ride_weekly_km         = parseFloat(final.stats.ride_weekly_km)
    if (final.stats?.ride_speed)     preferences.ride_speed_kmh         = parseFloat(final.stats.ride_speed)
    if (final.stats?.swim_weekly_km)         preferences.swim_weekly_km          = parseFloat(final.stats.swim_weekly_km)
    if (final.stats?.swim_pace_per_100m)     preferences.swim_pace_per_100m      = final.stats.swim_pace_per_100m
    if (final.stats?.swim_session_distance_m) preferences.swim_session_distance_m = parseFloat(final.stats.swim_session_distance_m)
    if (final.stats?.training_days)  preferences.training_days          = final.stats.training_days

    // Save to Supabase (always fast — separate from Railway)
    await Promise.all([
      supabase.from('users').upsert({
        id: DEMO_USER_ID,
        name: 'Athlete',
        disciplines: final.disciplines,
        training_phase: final.phase,
        training_style: 'moderate',
        preferences,
        coach_notes_freetext: final.coachNote,
        onboarding_complete: false,
      }),
      supabase.from('goals').upsert({
        id: '00000000-0000-0000-0000-000000000002',
        user_id: DEMO_USER_ID,
        discipline: final.disciplines.length > 1 ? 'triathlon' : final.disciplines[0],
        event_type: final.eventType || null,
        target_date: final.targetDate || null,
        status: 'active',
      }),
    ])

    // Wait for Railway server to be fully awake before opening SSE.
    // If it was cold, this absorbs the 30-60s delay here with a visible
    // "Connecting…" message rather than a frozen spinner during plan generation.
    await waitForServer()
    setBuildMessage('Building your 12-week plan…')

    try {
      await new Promise<void>((resolve) => {
        const es = new EventSource(`/api/ai/generate-plan-stream?userId=${encodeURIComponent(DEMO_USER_ID)}`)

        // 20 second max wait — redirect to dashboard regardless
        const maxWait = setTimeout(() => { es.close(); resolve() }, 20_000)

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
    } catch {
      // non-fatal — user proceeds to dashboard
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', DEMO_USER_ID)

    if (updateErr) {
      console.error('[onboarding] update failed:', updateErr.message)
    }

    // refetchQueries waits for the DB round-trip to complete before returning.
    // Once it resolves, the cache has onboarding_complete: true, which triggers
    // App.tsx to re-render and unmount OnboardingFlow in favor of the dashboard.
    await queryClient.refetchQueries({ queryKey: ['user'] })
  }

  if (building) return <BuildingPlan message={buildMessage} />

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto flex flex-col">
      <div className="px-6 pt-6 pb-2 text-xs text-gray-400 uppercase tracking-widest font-medium">
        Coach
      </div>

      <div className="flex-1 overflow-y-auto">
        {step === 1 && (
          <Step1DisciplinesPhase
            initialDisciplines={data.disciplines ?? []}
            initialPhase={data.phase}
            onNext={(disciplines, phase) => next({ disciplines, phase })}
          />
        )}
        {step === 2 && (
          <Step2GoalStats
            disciplines={data.disciplines ?? []}
            phase={data.phase!}
            onNext={finish}
            onBack={back}
          />
        )}
      </div>
    </div>
  )
}
