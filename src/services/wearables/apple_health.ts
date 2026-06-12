// Apple HealthKit integration — structure ready, connection pending
// Implementation requires a native iOS app or React Native bridge
// Alternatively: use Health Auto Export app → webhook → this service
//
// Deduplication: use external_id = HKWorkout UUID

export interface HealthKitWorkout {
  uuid: string
  workoutActivityType: string   // HKWorkoutActivityTypeRunning etc.
  startDate: string
  endDate: string
  duration: number              // seconds
  totalDistance?: number        // metres
  totalEnergyBurned?: number    // kilocalories
  metadata?: Record<string, unknown>
}

export interface HealthKitSleepSample {
  uuid: string
  startDate: string
  endDate: string
  value: 'inBed' | 'asleep' | 'awake' | 'core' | 'deep' | 'rem'
  sourceRevision: { source: { name: string } }
}

export interface HealthKitHRVSample {
  uuid: string
  startDate: string
  value: number   // SDNN in ms
}

// Maps HealthKit activity type strings to our discipline types
const DISCIPLINE_MAP: Record<string, string> = {
  HKWorkoutActivityTypeRunning: 'run',
  HKWorkoutActivityTypeCycling: 'ride',
  HKWorkoutActivityTypeSwimming: 'swim',
  HKWorkoutActivityTypeTraditionalStrengthTraining: 'rest',
}

export function parseWorkouts(_healthExportPayload: unknown): HealthKitWorkout[] {
  // TODO: Implement parsing of Health Auto Export webhook payload
  // or native HealthKit data bridge output
  throw new Error('Apple Health integration not yet connected')
}

export function mapToWorkoutLog(workout: HealthKitWorkout, userId: string, sessionId?: string) {
  const durationMin = Math.round(workout.duration / 60)
  const distanceKm = workout.totalDistance ? workout.totalDistance / 1000 : null

  return {
    session_id: sessionId ?? null,
    user_id: userId,
    source: 'apple_health' as const,
    external_id: workout.uuid,
    logged_at: workout.startDate,
    actual_distance_km: distanceKm ? parseFloat(distanceKm.toFixed(2)) : null,
    actual_duration_minutes: durationMin,
    raw_data: workout,
  }
}

export function calculateSleepScore(samples: HealthKitSleepSample[]): number | null {
  // TODO: Implement sleep score calculation from HealthKit samples
  // Deep + REM = quality sleep, penalise fragmentation
  return null
}
