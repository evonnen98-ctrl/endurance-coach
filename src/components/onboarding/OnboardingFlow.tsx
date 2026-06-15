import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import type { Discipline, TrainingPhase } from '../../types'
import type { User } from '../../types'
import OnboardingStep1 from './OnboardingStep1'
import OnboardingStep2 from './OnboardingStep2'
import OnboardingStep3 from './OnboardingStep3'
import OnboardingStep4 from './OnboardingStep4'
import BuildingPlan from './BuildingPlan'
import { inferPreferredLongDay } from './OnboardingStep3'

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive'

interface DraftData {
  disciplines:        Discipline[]
  phase:              TrainingPhase | undefined
  fitnessLevel:       FitnessLevel | undefined
  eventType:          string
  targetDate:         string
  planStartDate:      string
  trainingDaysPerWeek: number | undefined
  selectedDays:       string[]
  preferredLongDay:   string
  stats:              Record<string, string>
  coachNote:          string
}

interface Props {
  existingUser: User | null
}

function getNextMonday(offsetWeeks = 0): string {
  const now = new Date()
  const day = now.getDay()
  const toMon = day === 1 ? 7 : (8 - day) % 7 || 7
  const d = new Date(now)
  d.setDate(now.getDate() + toMon + offsetWeeks * 7)
  return d.toISOString().slice(0, 10)
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
  const [step, setStep]             = useState(1)
  const [building, setBuilding]     = useState(false)
  const [buildMessage, setBuildMessage] = useState<string | null>(null)

  const existingPrefs = (existingUser?.preferences ?? {}) as Record<string, string | number>

  const [draft, setDraft] = useState<DraftData>({
    disciplines:         existingUser?.disciplines ?? [],
    phase:               (existingUser?.training_phase as TrainingPhase) ?? undefined,
    fitnessLevel:        (existingPrefs.fitness_level as FitnessLevel)   ?? undefined,
    eventType:           (existingPrefs.goal_event_type as string)        ?? '',
    targetDate:          '',
    planStartDate:       getNextMonday(0),
    trainingDaysPerWeek: Number(existingPrefs.training_days_per_week)    || undefined,
    selectedDays:        (existingPrefs.training_days as string ?? '').split(',').filter(Boolean),
    preferredLongDay:    (existingPrefs.preferred_long_day as string)    ?? 'Saturday',
    stats: {
      run_weekly_km:      existingPrefs.run_weekly_km  != null ? String(existingPrefs.run_weekly_km)  : '',
      run_pace:           (existingPrefs.run_pace_easy  as string) ?? '',
      ride_weekly_km:     existingPrefs.ride_weekly_km != null ? String(existingPrefs.ride_weekly_km) : '',
      ride_speed:         existingPrefs.ride_speed_kmh != null ? String(existingPrefs.ride_speed_kmh) : '',
      swim_weekly_km:     existingPrefs.swim_weekly_km != null ? String(existingPrefs.swim_weekly_km) : '',
      swim_pace_per_100m: (existingPrefs.swim_pace_per_100m as string) ?? '',
    },
    coachNote: existingUser?.coach_notes_freetext ?? '',
  })

  // Pre-fill eventType and targetDate from goals table when rebuilding
  useEffect(() => {
    if (!existingUser) return
    supabase
      .from('goals').select('event_type,target_date').eq('user_id', DEMO_USER_ID).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data: g }) => {
        if (g) setDraft(d => ({
          ...d,
          eventType:  g.event_type  ?? d.eventType,
          targetDate: g.target_date ?? '',
        }))
      })
  }, [existingUser])

  function patch(partial: Partial<DraftData>) {
    setDraft(d => ({ ...d, ...partial }))
  }

  // ── Main plan generation — preserves all field names / DB writes ──────────────
  async function finish(final: DraftData) {
    setBuilding(true)
    setBuildMessage('Connecting to your coach…')
    let planGenSucceeded = false

    // Build preferences object — same field names as before
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
    // training_days = comma-separated day names: "Tue,Thu,Sat,Sun"
    preferences.training_days = final.selectedDays.join(',')
    if (final.selectedDays.length > 0)   preferences.training_days_per_week = final.selectedDays.length

    // Delete existing plans so a clean plan is generated
    const { data: oldPlans } = await supabase
      .from('training_plans').select('id').eq('user_id', DEMO_USER_ID)
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
        event_type:  final.eventType  || null,
        target_date: final.targetDate || null,
        status:      'active',
      }),
    ])

    await waitForServer()
    setBuildMessage('Building your training plan…')

    // SSE plan generation (with one retry on failure)
    try {
      await new Promise<void>((resolve) => {
        const es = new EventSource(`/api/ai/generate-plan-stream?userId=${encodeURIComponent(DEMO_USER_ID)}`)
        const maxWait = setTimeout(() => { es.close(); resolve() }, 25_000)
        es.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data) as { type: string; message?: string }
            if (msg.type === 'status' && msg.message) setBuildMessage(msg.message)
            if (msg.type === 'done')  { planGenSucceeded = true; clearTimeout(maxWait); es.close(); resolve() }
            if (msg.type === 'error') { clearTimeout(maxWait); es.close(); resolve() }
          } catch {}
        }
        es.onerror = () => { clearTimeout(maxWait); es.close(); resolve() }
      })
    } catch {}

    if (!planGenSucceeded) {
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
              if (msg.type === 'done')  { planGenSucceeded = true; clearTimeout(maxWait); es.close(); resolve() }
              if (msg.type === 'error') { clearTimeout(maxWait); es.close(); resolve() }
            } catch {}
          }
          es.onerror = () => { clearTimeout(maxWait); es.close(); resolve() }
        })
      } catch {}
    }

    setBuildMessage('Almost there…')
    await supabase.from('users').update({ onboarding_complete: true }).eq('id', DEMO_USER_ID)

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
      <div className="flex-1 overflow-y-auto">

        {step === 1 && (
          <OnboardingStep1
            initialDisciplines={draft.disciplines}
            initialPhase={draft.phase}
            initialFitnessLevel={draft.fitnessLevel}
            onNext={(disciplines, phase, fitnessLevel) => {
              patch({ disciplines, phase, fitnessLevel })
              setStep(2)
              fetch('/api/health').catch(() => {})
            }}
          />
        )}

        {step === 2 && (
          <OnboardingStep2
            disciplines={draft.disciplines}
            phase={draft.phase!}
            initialEventType={draft.eventType}
            initialTargetDate={draft.targetDate}
            initialPlanStartDate={draft.planStartDate}
            onNext={p => { patch(p); setStep(3) }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <OnboardingStep3
            initialDaysPerWeek={draft.trainingDaysPerWeek}
            initialSelectedDays={draft.selectedDays}
            onNext={p => { patch(p); setStep(4) }}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <OnboardingStep4
            disciplines={draft.disciplines}
            initialStats={draft.stats}
            initialCoachNote={draft.coachNote}
            onNext={async p => {
              const updatedDraft: DraftData = {
                ...draft,
                ...p,
                // Ensure preferredLongDay is set (may not be if user skipped back from step 3)
                preferredLongDay: draft.preferredLongDay || inferPreferredLongDay(draft.selectedDays),
              }
              setDraft(updatedDraft)
              await finish(updatedDraft)
            }}
            onBack={() => setStep(3)}
          />
        )}

      </div>
    </div>
  )
}
