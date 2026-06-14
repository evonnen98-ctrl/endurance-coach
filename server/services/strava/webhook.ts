import { fetchActivity } from './api.js'
import { importSingleActivity } from './import.js'
import { supabase } from '../../lib/supabase.js'

export interface StravaWebhookEvent {
  object_type: string
  object_id: number
  aspect_type: 'create' | 'update' | 'delete'
  owner_id: number
  subscription_id: number
  event_time: number
  updates: Record<string, string>
}

export async function handleWebhookEvent(event: StravaWebhookEvent): Promise<void> {
  if (event.object_type !== 'activity' || event.aspect_type !== 'create') return

  // Look up which user owns this Strava athlete_id — never hardcode
  const { data: conn } = await supabase
    .from('strava_connections')
    .select('user_id')
    .eq('athlete_id', event.owner_id)
    .single()

  if (!conn) {
    console.warn('[webhook] no user found for athlete_id:', event.owner_id)
    return
  }

  const activity = await fetchActivity(event.object_id, conn.user_id)
  await importSingleActivity(activity, conn.user_id, true)
}
