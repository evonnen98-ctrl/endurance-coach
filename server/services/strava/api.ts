import { getFreshAccessToken } from './auth.js'

const BASE = 'https://www.strava.com/api/v3'

export interface StravaActivity {
  id: number
  name: string
  sport_type: string
  start_date: string
  distance: number          // metres
  moving_time: number       // seconds
  elapsed_time: number      // seconds
  average_heartrate?: number
  average_watts?: number
  average_speed: number     // metres per second
  map?: { summary_polyline: string }
}

// userId is required — no hardcoded default. Every caller must supply the current user.
async function stravaFetch<T>(path: string, userId: string): Promise<T> {
  const token = await getFreshAccessToken(userId)
  if (!token) throw new Error('No Strava connection — user has not authorised Strava')

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Strava API error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function getAthlete(userId: string) {
  return stravaFetch<{ id: number; firstname: string; lastname: string; profile: string }>(
    '/athlete',
    userId,
  )
}

export async function fetchActivity(activityId: number, userId: string): Promise<StravaActivity> {
  return stravaFetch<StravaActivity>(`/activities/${activityId}`, userId)
}

export async function fetchRecentActivities(afterUnix: number, userId: string): Promise<StravaActivity[]> {
  const all: StravaActivity[] = []
  let page = 1

  while (true) {
    const page_results = await stravaFetch<StravaActivity[]>(
      `/athlete/activities?after=${afterUnix}&per_page=100&page=${page}`,
      userId,
    )
    if (!page_results.length) break
    all.push(...page_results)
    if (page_results.length < 100) break
    page++
  }

  return all
}
