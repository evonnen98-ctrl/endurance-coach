// Strava API integration — structure ready, connection pending
// Docs: https://developers.strava.com/docs/reference/
//
// OAuth flow: redirect to Strava → auth code → exchange for tokens → store refresh token
// Webhook: register for activity:create events for real-time ingestion
// Deduplication: use external_id = strava activity id

export interface StravaActivity {
  id: number
  name: string
  type: string              // 'Run' | 'Ride' | 'Swim' | 'VirtualRide' | ...
  start_date: string
  distance: number          // metres
  moving_time: number       // seconds
  elapsed_time: number      // seconds
  average_heartrate?: number
  average_watts?: number
  average_speed: number     // metres per second
  sport_type: string
  map?: { summary_polyline: string }
}

export interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: number
}

export async function exchangeCodeForTokens(_code: string): Promise<StravaTokens> {
  // TODO: POST https://www.strava.com/oauth/token
  // Body: client_id, client_secret, code, grant_type=authorization_code
  throw new Error('Strava integration not yet connected. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to .env')
}

export async function refreshAccessToken(_refreshToken: string): Promise<StravaTokens> {
  // TODO: POST https://www.strava.com/oauth/token
  // Body: client_id, client_secret, refresh_token, grant_type=refresh_token
  throw new Error('Strava integration not yet connected')
}

export async function fetchRecentActivities(
  _accessToken: string,
  _after?: number,
  _perPage = 30
): Promise<StravaActivity[]> {
  // TODO: GET https://www.strava.com/api/v3/athlete/activities
  throw new Error('Strava integration not yet connected')
}

export function mapToWorkoutLog(activity: StravaActivity, userId: string, sessionId?: string) {
  const distanceKm = activity.distance / 1000
  const durationMin = Math.round(activity.moving_time / 60)
  const paceSecsPerKm = (activity.moving_time / distanceKm)
  const paceMin = Math.floor(paceSecsPerKm / 60)
  const paceSec = Math.round(paceSecsPerKm % 60)
  const paceStr = `${paceMin}:${paceSec.toString().padStart(2, '0')}/km`

  return {
    session_id: sessionId ?? null,
    user_id: userId,
    source: 'strava' as const,
    external_id: String(activity.id),
    logged_at: activity.start_date,
    actual_distance_km: parseFloat(distanceKm.toFixed(2)),
    actual_duration_minutes: durationMin,
    average_hr: activity.average_heartrate ?? null,
    average_pace_per_km: paceStr,
    average_power_watts: activity.average_watts ?? null,
    raw_data: activity,
  }
}
