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
  fitnessLevel: string
  trainingDaysPerWeek: number
  preferredLongDay: string
  eventType: string
  targetDate: string
  planStartDate: string
  stats: Record<string, string>
  coachNote: string
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

  // Pre-fill from existing user when rebuilding
  const existingPrefs = (existingUser?.preferences ?? {}) as Record<string, string | number>
  const [data, setData] = useState<Partial<OnboardingData>>({
    disciplines:         existingUser?.disciplines ?? [],
    phase:               (existingUser?.training_phase as TrainingPhase) ?? undefined,
    fitnessLevel:        (existingPrefs.fitness_level as string)           ?? undefined,
    trainingDaysPerWeek: Number(existingPrefs.training_days_per_week)      || undefined,
    preferredLongDay:    (existingPrefs.preferred_long_day as string)      ?? undefined,
  })

  function next(patch: Partial<OnboardingData>) {
    setData(prev => ({ ...prev, ...patch }))
    setStep(s => s + 1)
    fetch('/api/health').catch(() => {})
  }

  function back() {
    setStep(s => s - 1)
  }

  async function finish(patch: { eventType: string; targetDate: string; planStartDate: string; stats: Record<string, string>; coachNote: string }) {
    const final = { ...data, ...patch } as OnboardingData

    setBuildMessage('Connecting to your coach…')
    setBuilding(true)

    const preferences: Record<string, string | number> = {}
    if (final.stats?.run_weekly_km)      preferences.run_weekly_km         = parseFloat(final.stats.run_weekly_km)
    if (final.stats?.run_pace)           preferences.run_pace_easy         = final.stats.run_pace
    if (final.stats?.ride_weekly_km)     preferences.ride_weekly_km        = parseFloat(final.stats.ride_weekly_km)
    if (final.stats?.ride_speed)         preferences.ride_speed_kmh        = parseFloat(final.stats.ride_speed)
    if (final.stats?.swim_weekly_km)     preferences.swim_weekly_km        = parseFloat(final.stats.swim_weekly_km)
    if (final.stats?.swim_pace_per_100m) preferences.swim_pace_per_100m    = final.stats.swim_pace_per_100m
    if (final.stats?.training_days)      preferences.training_days         = final.stats.training_days
    if (final.fitnessLevel)              preferences.fitness_level          = final.fitnessLevel
    if (final.trainingDaysPerWeek)       preferences.training_days_per_week = final.trainingDaysPerWeek
    if (final.preferredLongDay)          preferences.preferred_long_day     = final.preferredLongDay
    if (final.eventType)                 preferences.goal_event_type        = final.eventType
    if (final.planStartDate)             preferences.plan_start_date        = final.planStartDate

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
    setBuildMessage('Building your 12-week plan…')

    try {
      await new Promise<void>((resolve) => {
        const es = new EventSource(`/api/ai/generate-plan-stream?userId=${encodeURIComponent(DEMO_USER_ID)}`)
        const maxWait = setTimeout(() => { es.close(); resolve() }, 20_000)
        es.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as { type: string; message?: string }
            if (msg.type === 'status' && msg.message) setBuildMessage(msg.message)
            if (msg.type === 'done' || msg.type === 'error') { clearTimeout(maxWait); es.close(); resolve() }
          } catch {}
        }
        es.onerror = () => { clearTimeout(maxWait); es.close(); resolve() }
      })
    } catch {}

    await supabase.from('users').update({ onboarding_complete: true }).eq('id', DEMO_USER_ID)
    await queryClient.refetchQueries({ queryKey: ['user'] })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['active-plan-id'] }),
      queryClient.invalidateQueries({ queryKey: ['all-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['week-sessions'] }),
      queryClient.invalidateQueries({ queryKey: ['today-session'] }),
      queryClient.invalidateQueries({ queryKey: ['active-goal'] }),
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
            onNext={finish}
            onBack={back}
          />
        )}
      </div>
    </div>
  )
}
