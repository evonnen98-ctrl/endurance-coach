import { supabase } from '../../lib/supabase.js'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'

export interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: number // unix timestamp
  athlete?: {
    id: number
    firstname: string
    lastname: string
    profile: string // photo URL
  }
}

export async function exchangeCodeForTokens(code: string): Promise<StravaTokens> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Strava token exchange failed: ${body}`)
  }
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Strava token refresh failed')
  return res.json()
}

export async function saveConnection(tokens: StravaTokens, userId: string = DEMO_USER_ID): Promise<void> {
  // strava_connections.user_id has FK → users.id. The user row may not exist yet
  // if we're mid-onboarding (before finish() runs). Ensure it exists first.
  await supabase.from('users').upsert(
    { id: userId, name: 'Athlete' },
    { onConflict: 'id', ignoreDuplicates: true }
  )

  const { athlete } = tokens
  const { error } = await supabase.from('strava_connections').upsert({
    user_id: userId,
    athlete_id: athlete?.id ?? 0,
    athlete_name: athlete ? `${athlete.firstname} ${athlete.lastname}` : null,
    athlete_photo_url: athlete?.profile ?? null,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`)
}

export async function getConnection(userId: string = DEMO_USER_ID) {
  const { data } = await supabase
    .from('strava_connections')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function getFreshAccessToken(userId: string = DEMO_USER_ID): Promise<string | null> {
  const conn = await getConnection(userId)
  if (!conn) return null

  const expiresAt = new Date(conn.expires_at).getTime()
  const nowMs = Date.now()

  // Refresh if token expires within 5 minutes
  if (expiresAt - nowMs < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(conn.refresh_token)
    await supabase.from('strava_connections').update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
    return refreshed.access_token
  }

  return conn.access_token
}

export async function deleteConnection(userId: string = DEMO_USER_ID): Promise<void> {
  await supabase.from('strava_connections').delete().eq('user_id', userId)
}
