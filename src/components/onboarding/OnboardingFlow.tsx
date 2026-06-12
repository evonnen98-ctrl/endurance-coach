import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import { api } from '../../lib/api'
import type { Discipline, TrainingPhase } from '../../types'
import type { User } from '../../types'
import Step1Disciplines from './Step1Disciplines'
import Step2Phase from './Step2Phase'
import Step3Goal from './Step3Goal'
import Step4Stats from './Step4Stats'
import BuildingPlan from './BuildingPlan'

interface Props {
  existingUser: User | null
}

export interface OnboardingData {
  disciplines: Discipline[]
  phase: TrainingPhase
  eventType: string
  targetDate: string
  stats: Record<string, string>
  coachNote: string
}

const STEPS = 4

export default function OnboardingFlow({ existingUser }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [building, setBuilding] = useState(false)
  const [data, setData] = useState<Partial<OnboardingData>>({
    disciplines: existingUser?.disciplines ?? [],
  })

  const progress = ((step - 1) / STEPS) * 100

  function next(patch: Partial<OnboardingData>) {
    setData(prev => ({ ...prev, ...patch }))
    setStep(s => s + 1)
  }

  function back() {
    setStep(s => s - 1)
  }

  async function finish(patch: Partial<OnboardingData>) {
    const final = { ...data, ...patch } as OnboardingData
    setBuilding(true)

    const preferences: Record<string, string | number> = {}
    if (final.stats?.run_weekly_km) preferences.run_weekly_km = parseFloat(final.stats.run_weekly_km)
    if (final.stats?.run_pace) preferences.run_pace_easy = final.stats.run_pace
    if (final.stats?.ride_weekly_km) preferences.ride_weekly_km = parseFloat(final.stats.ride_weekly_km)
    if (final.stats?.ride_effort) preferences.ride_effort = final.stats.ride_effort
    if (final.stats?.swim_weekly_km) preferences.swim_weekly_km = parseFloat(final.stats.swim_weekly_km)
    if (final.stats?.swim_pace) preferences.swim_pace_100m = final.stats.swim_pace

    const ftp = final.stats?.ftp ? parseInt(final.stats.ftp) : undefined

    await supabase.from('users').upsert({
      id: DEMO_USER_ID,
      name: 'Alex',
      disciplines: final.disciplines,
      training_phase: final.phase,
      training_style: 'moderate',
      preferences,
      ftp,
      coach_notes_freetext: final.coachNote,
      onboarding_complete: false,
    })

    await supabase.from('goals').upsert({
      id: '00000000-0000-0000-0000-000000000002',
      user_id: DEMO_USER_ID,
      discipline: final.disciplines.length > 1 ? 'triathlon' : final.disciplines[0],
      event_type: final.eventType,
      target_date: final.targetDate || null,
      status: 'active',
    })

    try {
      await api.generatePlan(DEMO_USER_ID)
    } catch {
      // graceful degradation — app still works, plan generation will be retried
    }

    await supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', DEMO_USER_ID)

    await queryClient.invalidateQueries({ queryKey: ['user'] })
  }

  if (building) return <BuildingPlan />

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-black transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="px-6 pt-6 pb-2 text-xs text-gray-400 uppercase tracking-widest font-medium">
        Coach
      </div>

      <div className="flex-1 overflow-y-auto">
        {step === 1 && (
          <Step1Disciplines
            selected={data.disciplines ?? []}
            onNext={disciplines => next({ disciplines })}
          />
        )}
        {step === 2 && (
          <Step2Phase
            selected={data.phase}
            onNext={phase => next({ phase })}
            onBack={back}
          />
        )}
        {step === 3 && (
          <Step3Goal
            disciplines={data.disciplines ?? []}
            phase={data.phase!}
            eventType={data.eventType ?? ''}
            targetDate={data.targetDate ?? ''}
            onNext={(eventType, targetDate) => next({ eventType, targetDate })}
            onBack={back}
          />
        )}
        {step === 4 && (
          <Step4Stats
            disciplines={data.disciplines ?? []}
            onNext={(stats, coachNote) => finish({ stats, coachNote })}
            onBack={back}
          />
        )}
      </div>
    </div>
  )
}
