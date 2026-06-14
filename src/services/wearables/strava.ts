// Strava integration — OAuth and data import are handled server-side via /api/strava/*.
// This module re-exports shared types for use in frontend components.

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
