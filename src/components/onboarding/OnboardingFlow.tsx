import { useState, useEffect } from 'react'
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
  fitnessLevel: string
  trainingDaysPerWeek: number
  preferredLongDay: string
  eventType: string
  targetDate: string
  planStartDate: string
  stats: Record<string, string>
  coachNote: string
  selectedDays: string[]
}

async function waitForServer(maxMs = 55_000): Promise<void> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch('/api/health', { signal: AbortSignal.timeout(5_000) })
      if (r.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 1_000))
  }
}

export default function OnboardingFlow({ existingUser }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [building, setBuilding] = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)
  const [existingGoal, setExistingGoal] = useState<{ event_type?: string; target_date?: string } | null>(null)

  // Pre-fill from existing user when rebuilding
  const existingPrefs = (existingUser?.preferences ?? {}) as Record<string, string | number>
  const [data, setData] = useState<Partial<OnboardingData>>({
    disciplines:         existingUser?.disciplines ?? [],
    phase:               (existingUser?.training_phase as TrainingPhase) ?? undefined,
    fitnessLevel:        (existingPrefs.fitness_level as string)           ?? undefined,
    trainingDaysPerWeek: Number(existingPrefs.training_days_per_week)      || undefined,
    preferredLongDay:    (existingPrefs.preferred_long_day as string)      ?? undefined,
  })

  // Fetch existing goal for pre-fill in step 2
  useEffect(() => {
    if (!existingUser) return
    supabase
      .from('goals').select('event_type,target_date').eq('user_id', DEMO_USER_ID).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data: g }) => { if (g) setExistingGoal(g) })
  }, [existingUser])

  function next(patch: Partial<OnboardingData>) {
    setData(prev => ({ ...prev, ...patch }))
    setStep(s => s + 1)
    fetch('/api/health').catch(() => {})
  }

  function back() {
    setStep(s => s - 1)
  }

  async function finish(patch: { eventType: string; targetDate: string; planStartDate: string; stats: Record<string, string>; coachNote: string; selectedDays: string[] }) {
    const final = { ...data, ...patch } as OnboardingData

    setBuildMessage('Connecting to your coach…')
    setBuilding(true)
    let planGenSucceeded = false

    const preferences: Record<string, string | number> = {}
    if (final.stats?.run_weekly_km)      preferences.run_weekly_km         = parseFloat(final.stats.run_weekly_km)
    if (final.stats?.run_pace)           preferences.run_pace_easy         = final.stats.run_pace
    if (final.stats?.ride_weekly_km)     preferences.ride_weekly_km        = parseFloat(final.stats.ride_weekly_km)
    if (final.stats?.ride_speed)         preferences.ride_speed_kmh        = parseFloat(final.stats.ride_speed)
    if (final.stats?.swim_weekly_km)     preferences.swim_weekly_km        = parseFloat(final.stats.swim_weekly_km)
    if (final.stats?.swim_pace_per_100m) preferences.swim_pace_per_100m    = final.stats.swim_pace_per_100m
    if (final.coachNote)                 preferences.coach_notes            = final.coachNote
    if (final.fitnessLevel)              preferences.fitness_level          = final.fitnessLevel
    if (final.trainingDaysPerWeek)       preferences.training_days_per_week = final.trainingDaysPerWeek
    if (final.preferredLongDay)          preferences.preferred_long_day     = final.preferredLongDay
    if (final.eventType)                 preferences.goal_event_type        = final.eventType
    if (final.planStartDate)             preferences.plan_start_date        = final.planStartDate
    // Save specific training days from the day-picker (not the free-text stats field)
    const selectedDays = patch.selectedDays ?? []
    preferences.training_days = selectedDays.join(',')
    if (selectedDays.length > 0) preferences.training_days_per_week = selectedDays.length

    // Delete any existing plans and their sessions so a clean plan is generated
    const { data: oldPlans } = await supabase
      .from('training_plans')
      .select('id')
      .eq('user_id', DEMO_USER_ID)
    if (oldPlans?.length) {
      const oldIds = oldPlans.map(p => p.id)
      await supabase.from('sessions').delete().in('plan_id', oldIds)
      await supabase.from('training_plans').delete().in('id', oldIds)
    }

    await Promise.all([
      supabase.from('users').upsert({
        id:                   DEMO_USER_ID,
        name:                 existingUser?.name ?? 'Athlete',
        disciplines:          final.disciplines,
        training_phase:       final.phase,
        training_style:       existingUser?.training_style ?? 'moderate',
        preferences,
        coach_notes_freetext: final.coachNote || existingUser?.coach_notes_freetext || null,
        onboarding_complete:  false,
      }),
      supabase.from('goals').upsert({
        id:          '00000000-0000-0000-0000-000000000002',
        user_id:     DEMO_USER_ID,
        discipline:  final.disciplines.length > 1 ? 'triathlon' : final.disciplines[0],
        event_type:  final.eventType || null,
        target_date: final.targetDate || null,
        status:      'active',
      }),
    ])

    await waitForServer()
    setBuildMessage('Building your training plan…')

    try {
      await new Promise<void>((resolve) => {
        const es = new EventSource(`/api/ai/generate-plan-stream?userId=${encodeURIComponent(DEMO_USER_ID)}`)
        const maxWait = setTimeout(() => { es.close(); resolve() }, 25_000)
        es.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as { type: string; message?: string }
            if (msg.type === 'status' && msg.message) setBuildMessage(msg.message)
            if (msg.type === 'done') { planGenSucceeded = true; clearTimeout(maxWait); es.close(); resolve() }
            if (msg.type === 'error') { console.error('[onboarding] plan gen error:', msg.message); clearTimeout(maxWait); es.close(); resolve() }
          } catch {}
        }
        es.onerror = () => { clearTimeout(maxWait); es.close(); resolve() }
      })
    } catch {}

    if (!planGenSucceeded) {
      // Retry once after a short delay (handles cold-start race conditions)
      setBuildMessage('Finalising your plan…')
      await new Promise(r => setTimeout(r, 2000))
      try {
        await new Promise<void>((resolve) => {
          const es = new EventSource(`/api/ai/generate-plan-stream?userId=${encodeURIComponent(DEMO_USER_ID)}`)
          const maxWait = setTimeout(() => { es.close(); resolve() }, 25_000)
          es.onmessage = (e) => {
            try {
              const msg = JSON.parse(e.data) as { type: string; message?: string }
              if (msg.type === 'status' && msg.message) setBuildMessage(msg.message)
              if (msg.type === 'done') { planGenSucceeded = true; clearTimeout(maxWait); es.close(); resolve() }
              if (msg.type === 'error') { clearTimeout(maxWait); es.close(); resolve() }
            } catch {}
          }
          es.onerror = () => { clearTimeout(maxWait); es.close(); resolve() }
        })
      } catch {}
    }

    setBuildMessage('Almost there…')
    await supabase.from('users').update({ onboarding_complete: true }).eq('id', DEMO_USER_ID)

    // Refetch all plan data BEFORE flipping onboarding_complete so the
    // dashboard renders with data immediately rather than showing "No plan yet"
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['active-plan-id'] }),
      queryClient.refetchQueries({ queryKey: ['active-goal'] }),
    ])
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['user'] }),
      queryClient.invalidateQueries({ queryKey: ['all-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['week-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['today-session'] }),
    ])
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
            initialFitnessLevel={data.fitnessLevel as any}
            initialTrainingDays={data.trainingDaysPerWeek}
            initialPreferredLongDay={data.preferredLongDay}
            onNext={(disciplines, phase, fitnessLevel, trainingDaysPerWeek, preferredLongDay) =>
              next({ disciplines, phase, fitnessLevel, trainingDaysPerWeek, preferredLongDay })
            }
          />
        )}
        {step === 2 && (
          <Step2GoalStats
            disciplines={data.disciplines ?? []}
            phase={data.phase!}
            initialEventType={existingGoal?.event_type ?? (existingPrefs.goal_event_type as string) ?? ''}
            initialTargetDate={existingGoal?.target_date ?? ''}
            initialStats={{
              run_weekly_km:    existingPrefs.run_weekly_km   != null ? String(existingPrefs.run_weekly_km)   : '',
              run_pace:         (existingPrefs.run_pace_easy  as string) ?? '',
              ride_weekly_km:   existingPrefs.ride_weekly_km  != null ? String(existingPrefs.ride_weekly_km)  : '',
              ride_speed:       existingPrefs.ride_speed_kmh  != null ? String(existingPrefs.ride_speed_kmh)  : '',
              swim_weekly_km:   existingPrefs.swim_weekly_km  != null ? String(existingPrefs.swim_weekly_km)  : '',
              swim_pace_per_100m: (existingPrefs.swim_pace_per_100m as string) ?? '',
            }}
            initialSelectedDays={(existingPrefs.training_days as string ?? '').split(',').filter(Boolean)}
            initialCoachNote={existingUser?.coach_notes_freetext ?? ''}
            onNext={finish}
            onBack={back}
          />
        )}
      </div>
    </div>
  )
}
