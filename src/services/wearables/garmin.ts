// Garmin Connect API integration — structure ready, connection pending
// Docs: https://developer.garmin.com/gc-developer-program/overview/
//
// OAuth flow: device → Garmin Connect → OAuth token → this service
// Deduplication: use external_id = garmin activity id

export interface GarminActivity {
  activityId: string
  activityName: string
  startTimeLocal: string
  distance: number          // metres
  duration: number          // seconds
  averageHR?: number
  averagePace?: number      // seconds per metre
  averagePower?: number     // watts
  hrv?: number
  calories?: number
  sport: string             // 'running' | 'cycling' | 'swimming' | 'other'
}

export interface GarminSleep {
  calendarDate: string
  sleepTimeSeconds: number
  deepSleepSeconds: number
  remSleepSeconds: number
  lightSleepSeconds: number
  averageHRV?: number
  sleepScore?: number
}

export async function fetchRecentActivities(
  _accessToken: string,
  _limit = 20
): Promise<GarminActivity[]> {
  // TODO: Implement when Garmin OAuth is connected
  // GET https://apis.garmin.com/wellness-api/rest/activities
  throw new Error('Garmin integration not yet connected. Add GARMIN_CLIENT_ID and GARMIN_CLIENT_SECRET to .env')
}

export async function fetchSleep(
  _accessToken: string,
  _startDate: string,
  _endDate: string
): Promise<GarminSleep[]> {
  // TODO: Implement when Garmin OAuth is connected
  // GET https://apis.garmin.com/wellness-api/rest/sleeps
  throw new Error('Garmin integration not yet connected')
}

export function mapToWorkoutLog(activity: GarminActivity, userId: string, sessionId?: string) {
  const distanceKm = activity.distance / 1000
  const durationMin = Math.round(activity.duration / 60)

  return {
    session_id: sessionId ?? null,
    user_id: userId,
    source: 'garmin' as const,
    external_id: activity.activityId,
    logged_at: activity.startTimeLocal,
    actual_distance_km: parseFloat(distanceKm.toFixed(2)),
    actual_duration_minutes: durationMin,
    average_hr: activity.averageHR ?? null,
    average_power_watts: activity.averagePower ?? null,
    hrv: activity.hrv ?? null,
    raw_data: activity,
  }
}
