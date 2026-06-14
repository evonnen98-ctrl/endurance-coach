import type { StravaActivity } from './api.js'
import { supabase } from '../../lib/supabase.js'
import { buildUserContext } from '../userContext.js'
import { generatePostWorkoutResponse } from '../ai/postWorkoutResponse.js'

type Discipline = 'swim' | 'ride' | 'run'

const SPORT_TYPE_MAP: Record<string, Discipline | null> = {
  Run: 'run', TrailRun: 'run', VirtualRun: 'run', Walk: 'run',
  Ride: 'ride', VirtualRide: 'ride', EBikeRide: 'ride',
  GravelRide: 'ride', MountainBikeRide: 'ride',
  Swim: 'swim', OpenWaterSwim: 'swim',
}

function formatPace(metersPerSecond: number): string {
  const secsPerKm = 1000 / metersPerSecond
  const min = Math.floor(secsPerKm / 60)
  const sec = Math.round(secsPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}/km`
}

// userId is explicit — no hardcoded default anywhere in this file
function mapActivity(activity: StravaActivity, userId: string, sessionId?: string) {
  const discipline = SPORT_TYPE_MAP[activity.sport_type]
  const distanceKm = parseFloat((activity.distance / 1000).toFixed(2))
  const durationMin = Math.round(activity.moving_time / 60)

  return {
    session_id: sessionId ?? null,
    user_id: userId,
    source: 'strava',
    external_id: String(activity.id),
    logged_at: activity.start_date,
    actual_distance_km: distanceKm || null,
    actual_duration_minutes: durationMin || null,
    average_hr: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    average_pace_per_km: (discipline === 'run' && activity.average_speed)
      ? formatPace(activity.average_speed) : null,
    average_power_watts: activity.average_watts ? Math.round(activity.average_watts) : null,
    raw_data: activity,
    discipline_tag: discipline,
  }
}

async function findMatchingSession(activityDate: string, discipline: Discipline | null, userId: string) {
  if (!discipline) return null
  const dateOnly = activityDate.substring(0, 10)

  const { data } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('scheduled_date', dateOnly)
    .eq('discipline', discipline)
    .single()

  return data?.id ?? null
}

export interface ImportResult {
  imported: number
  skipped: number
  total: number
}

export async function importActivities(activities: StravaActivity[], userId: string): Promise<ImportResult> {
  // Filter to supported disciplines only
  const supported = activities.filter(a => SPORT_TYPE_MAP[a.sport_type] != null)

  if (supported.length === 0) {
    return { imported: 0, skipped: activities.length, total: activities.length }
  }

  // Single batch dedup check — one query instead of one per activity
  const externalIds = supported.map(a => String(a.id))
  const { data: existing } = await supabase
    .from('workout_logs')
    .select('external_id')
    .eq('user_id', userId)
    .in('external_id', externalIds)

  const existingSet = new Set((existing ?? []).map(e => e.external_id as string))
  const toImport = supported.filter(a => !existingSet.has(String(a.id)))

  if (toImport.length === 0) {
    return { imported: 0, skipped: activities.length, total: activities.length }
  }

  // Build rows — skip session matching during bulk import (no plan exists yet)
  const rows = toImport.map(activity => {
    const { discipline_tag: _, ...insertData } = mapActivity(activity, userId) as any
    return insertData
  })

  // Batch insert in chunks of 100
  let imported = 0
  for (let i = 0; i < rows.length; i += 100) {
    const { data, error } = await supabase
      .from('workout_logs')
      .insert(rows.slice(i, i + 100))
      .select('id')
    if (!error && data) imported += data.length
    else if (error) console.error('[strava] batch insert error:', error.message)
  }

  return { imported, skipped: activities.length - imported, total: activities.length }
}

export async function importSingleActivity(
  activity: StravaActivity,
  userId: string,
  triggerAiResponse = true,
): Promise<void> {
  const discipline = SPORT_TYPE_MAP[activity.sport_type]
  if (!discipline) return

  // Dedup check
  const { data: existing } = await supabase
    .from('workout_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', String(activity.id))
    .single()

  if (existing) return

  const sessionId = await findMatchingSession(activity.start_date, discipline, userId)
  const log = mapActivity(activity, userId, sessionId ?? undefined) as any
  const { discipline_tag: _dt, ...insertData } = log

  const { data: inserted, error } = await supabase
    .from('workout_logs')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    if (error.code !== '23505') console.error('Webhook import error:', error.message)
    return
  }

  if (sessionId) {
    await supabase.from('sessions').update({ status: 'complete' }).eq('id', sessionId)
  }

  if (triggerAiResponse && inserted) {
    try {
      const context = await buildUserContext(userId)
      const result = await generatePostWorkoutResponse(
        inserted.id,
        sessionId ?? undefined,
        undefined,
        undefined,
        inserted.actual_distance_km ?? undefined,
        inserted.actual_duration_minutes ?? undefined,
        context,
      )
      await supabase
        .from('workout_logs')
        .update({ coach_response: result.coach_response })
        .eq('id', inserted.id)
    } catch (err) {
      console.error('AI response after Strava import failed:', err)
    }
  }
}
