import { Router, type Request } from 'express'
import { exchangeCodeForTokens, saveConnection, getConnection, deleteConnection } from '../services/strava/auth.js'
import { fetchRecentActivities } from '../services/strava/api.js'
import { importActivities } from '../services/strava/import.js'
import { handleWebhookEvent } from '../services/strava/webhook.js'
import { supabase } from '../lib/supabase.js'

const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'

const router = Router()

function appUrl(req: Request): string {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  if (process.env.APP_URL) return process.env.APP_URL
  return `${req.protocol}://${req.get('host')}`
}

// ── OAuth: redirect to Strava authorization page ──────────────────────────────
router.get('/auth', (req, res) => {
  const clientId = process.env.STRAVA_CLIENT_ID
  if (!clientId) {
    return res.status(500).json({ error: 'STRAVA_CLIENT_ID not configured' })
  }
  // Embed userId in state so callback can save tokens to the right user row
  const userId = (req.query.userId as string) || DEMO_USER_ID
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64')
  const callback = encodeURIComponent(`${appUrl(req)}/api/strava/callback`)
  const scope = 'read,activity:read_all'
  res.redirect(
    `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${callback}&approval_prompt=auto&scope=${scope}&state=${state}`
  )
})

// ── OAuth: exchange code for tokens ───────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>

  // Strava sends ?error=access_denied when user declines — serve popup HTML so
  // it closes cleanly instead of loading the full React app in the popup.
  if (error || !code) {
    console.log('[strava] callback denied:', error ?? 'no code')
    return res.send(popupHtml('denied'))
  }

  // Decode userId from state (falls back to DEMO_USER_ID if state is missing/malformed)
  let userId = DEMO_USER_ID
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      if (decoded.userId) userId = decoded.userId
    } catch {
      console.warn('[strava] could not decode state param, using default user')
    }
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await saveConnection(tokens, userId)
    console.log('[strava] connection saved for athlete:', tokens.athlete?.id, 'user:', userId)
    res.send(popupHtml('connected'))
  } catch (err: any) {
    console.error('[strava] callback error:', err.message)
    res.send(popupHtml('error', err.message))
  }
})

function popupHtml(result: 'connected' | 'error' | 'denied', debugMsg?: string): string {
  const ok = result === 'connected'
  const title = ok ? 'Connected to Strava' : result === 'denied' ? 'Not connected' : 'Connection failed'
  const sub = ok ? 'Closing this window…' : result === 'denied' ? 'You declined access. Close this window.' : 'Close this window and try again.'
  const iconColor = ok ? '#16a34a' : '#dc2626'
  const iconBg = ok ? '#dcfce7' : '#fee2e2'
  const icon = ok
    ? `<svg width="24" height="24" viewBox="0 0 20 20" fill="${iconColor}"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`
    : `<svg width="24" height="24" viewBox="0 0 20 20" fill="${iconColor}"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`
  const debug = debugMsg ? `<p style="font-size:11px;color:#ef4444;margin-top:8px;max-width:280px;word-break:break-word">${debugMsg.replace(/</g, '&lt;')}</p>` : ''

  return `<!DOCTYPE html>
<html>
<head>
  <title>Strava ${title}</title>
  <style>
    body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,sans-serif;background:#fff}
    .card{text-align:center}
    .icon{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;background:${iconBg}}
    strong{color:#111;font-size:18px;display:block;margin-bottom:4px}
    p{margin:0;color:#6b7280;font-size:14px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <strong>${title}</strong>
    <p>${sub}</p>
    ${debug}
  </div>
  <script>
    var origin = window.location.origin;
    if (window.opener) {
      try { window.opener.postMessage({ type: 'strava-connected', result: '${result}' }, origin); } catch(e) {}
      setTimeout(function(){ window.close(); }, ${ok ? 300 : 1500});
    } else {
      window.location.replace('/?strava=${result}');
    }
  </script>
</body>
</html>`
}

// ── Connection status ──────────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const userId = (req.query.userId as string) || DEMO_USER_ID
  const conn = await getConnection(userId)
  if (!conn) return res.json({ connected: false })
  res.json({
    connected: true,
    athlete_name: conn.athlete_name,
    athlete_photo_url: conn.athlete_photo_url,
  })
})

// ── Manual import: last 90 days ───────────────────────────────────────────────
router.post('/import', async (req, res) => {
  try {
    const userId = (req.body?.userId as string) || DEMO_USER_ID
    const t = Date.now()
    const afterUnix = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)

    const activities = await fetchRecentActivities(afterUnix, userId)
    console.log(`[strava] fetched ${activities.length} activities for user ${userId} in ${Date.now() - t}ms`)

    const result = await importActivities(activities, userId)
    console.log(`[strava] import done: ${JSON.stringify(result)} in ${Date.now() - t}ms`)
    res.json(result)
  } catch (err: any) {
    console.error('Strava import error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ── Disconnect ─────────────────────────────────────────────────────────────────
router.delete('/disconnect', async (req, res) => {
  const userId = (req.query.userId as string) || DEMO_USER_ID
  await deleteConnection(userId)
  res.json({ success: true })
})

// ── Webhook verification (Strava sends a GET to confirm the endpoint) ──────────
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    res.json({ 'hub.challenge': challenge })
  } else {
    res.status(403).json({ error: 'Verification failed' })
  }
})

// ── Webhook events ─────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  // Acknowledge immediately — Strava expects a fast 200
  res.sendStatus(200)

  try {
    await handleWebhookEvent(req.body)
  } catch (err: any) {
    console.error('Webhook processing error:', err.message)
  }
})

// ── Config check — confirm env vars are loaded ────────────────────────────────
router.get('/config-check', (_req, res) => {
  res.json({
    STRAVA_CLIENT_ID:            process.env.STRAVA_CLIENT_ID     ? '✓ set' : '✗ missing',
    STRAVA_CLIENT_SECRET:        process.env.STRAVA_CLIENT_SECRET  ? '✓ set' : '✗ missing',
    STRAVA_WEBHOOK_VERIFY_TOKEN: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ? '✓ set' : '✗ missing',
  })
})

// ── Full-stack diagnostic — checks every layer without a real code ────────────
router.get('/debug', async (req, res) => {
  const results: Record<string, string> = {}

  // 1. Env vars
  results.env_client_id      = process.env.STRAVA_CLIENT_ID            ? '✓' : '✗ missing'
  results.env_client_secret  = process.env.STRAVA_CLIENT_SECRET         ? '✓' : '✗ missing'
  results.env_verify_token   = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN  ? '✓' : '✗ missing'
  results.env_supabase_url   = process.env.VITE_SUPABASE_URL            ? `✓ ${process.env.VITE_SUPABASE_URL}` : '✗ missing'
  const svcKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  results.env_supabase_key   = svcKeyRaw ? `✓ set (ref=${(() => { try { return JSON.parse(Buffer.from(svcKeyRaw.split('.')[1], 'base64').toString()).ref } catch { return 'parse-err' } })()})` : '✗ missing'
  results.env_anthropic_key  = process.env.ANTHROPIC_API_KEY            ? '✓ set' : '✗ missing'

  // 2. Auth redirect URL
  const origin = appUrl(req)
  results.auth_redirect_url = `${origin}/api/strava/callback`

  // 3. Strava API reachability (using webhook list as a credential test)
  try {
    const r = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${process.env.STRAVA_CLIENT_ID}&client_secret=${process.env.STRAVA_CLIENT_SECRET}`
    )
    results.strava_api = r.ok ? `✓ HTTP ${r.status}` : `✗ HTTP ${r.status}`
  } catch (e: any) {
    results.strava_api = `✗ fetch error: ${e.message}`
  }

  // 3b. Raw Supabase URL tests — try root path and specific tables
  const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (supabaseUrl && svcKey) {
    const sbHeaders = { apikey: svcKey, Authorization: `Bearer ${svcKey}` }

    // Test PostgREST root (always succeeds if the API is reachable)
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/`, { headers: sbHeaders })
      results.supabase_rest_root = r.ok
        ? `✓ HTTP ${r.status} (PostgREST reachable)`
        : `✗ HTTP ${r.status}`
    } catch (e: any) {
      results.supabase_rest_root = `✗ ${e.message}`
    }

    // Test users table
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/users?limit=1`, { headers: sbHeaders })
      const body = await r.text()
      results.supabase_table_users = r.ok
        ? `✓ HTTP ${r.status}: ${body.slice(0, 60)}`
        : `✗ HTTP ${r.status}: ${body.slice(0, 120)}`
    } catch (e: any) {
      results.supabase_table_users = `✗ ${e.message}`
    }
  } else {
    results.supabase_rest_root = '✗ VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing'
    results.supabase_table_users = '✗ skipped'
  }

  // 4. Supabase: check demo user exists
  let schemaOk = false
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, onboarding_complete')
      .eq('id', DEMO_USER_ID)
      .maybeSingle()
    if (error) {
      results.supabase_user = `✗ ${error.message} (code: ${(error as any).code})`
      if ((error as any).code === 'PGRST125') {
        results.ACTION_REQUIRED = 'SCHEMA NOT APPLIED — tables do not exist. Add DATABASE_URL to Railway env vars (Supabase: Settings > Database > Connection string) and redeploy. This will auto-create all tables. Alternatively, paste supabase/schema.sql + supabase/migration_strava.sql into your Supabase SQL editor.'
      }
    } else {
      schemaOk = true
      results.supabase_user = data
        ? `✓ exists (onboarding_complete=${data.onboarding_complete})`
        : '✗ demo user not found — will be created on first Strava connect'
    }
  } catch (e: any) {
    results.supabase_user = `✗ ${e.message}`
  }

  // 5. Supabase: check strava_connections table
  if (schemaOk) {
    try {
      const { data, error } = await supabase
        .from('strava_connections')
        .select('user_id, athlete_name, updated_at')
        .eq('user_id', DEMO_USER_ID)
        .maybeSingle()
      if (error) results.supabase_strava = `✗ ${error.message}`
      else results.supabase_strava = data
        ? `✓ connected as ${data.athlete_name} (updated ${data.updated_at})`
        : '✗ no connection saved yet'
    } catch (e: any) {
      results.supabase_strava = `✗ ${e.message}`
    }
  } else {
    results.supabase_strava = '✗ skipped — fix schema first'
  }

  results.env_database_url = process.env.DATABASE_URL ? '✓ set (auto-migration enabled)' : '✗ not set (needed for auto-migration)'

  res.json(results)
})

// ── View current Strava webhook subscriptions ─────────────────────────────────
router.get('/webhook-subscriptions', async (_req, res) => {
  const clientId     = process.env.STRAVA_CLIENT_ID     ?? ''
  const clientSecret = process.env.STRAVA_CLIENT_SECRET ?? ''
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET not set' })
  }
  const r = await fetch(
    `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
  )
  res.json(await r.json())
})

// ── Register webhook — idempotent: deletes existing subscription first ─────────
router.post('/register-webhook', async (req, res) => {
  const clientId     = process.env.STRAVA_CLIENT_ID     ?? ''
  const clientSecret = process.env.STRAVA_CLIENT_SECRET ?? ''
  const verifyToken  = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? ''
  const callbackUrl  = `${appUrl(req)}/api/strava/webhook`

  if (!clientId || !clientSecret || !verifyToken) {
    return res.status(500).json({
      error: 'Missing env vars',
      missing: [
        !clientId     && 'STRAVA_CLIENT_ID',
        !clientSecret && 'STRAVA_CLIENT_SECRET',
        !verifyToken  && 'STRAVA_WEBHOOK_VERIFY_TOKEN',
      ].filter(Boolean),
    })
  }

  // 1. Check for an existing subscription
  const listRes = await fetch(
    `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
  )
  const existing: Array<{ id: number }> = await listRes.json()

  // 2. Delete any existing subscription so we can register fresh
  // Strava DELETE requires credentials as query params, not body
  for (const sub of Array.isArray(existing) ? existing : []) {
    await fetch(
      `https://www.strava.com/api/v3/push_subscriptions/${sub.id}?client_id=${clientId}&client_secret=${clientSecret}`,
      { method: 'DELETE' }
    )
  }

  // 3. Register new subscription
  const createRes = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    body: new URLSearchParams({
      client_id:    clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    }),
  })
  const data = await createRes.json()

  if (data.id) {
    res.json({ success: true, subscription_id: data.id, callback_url: callbackUrl })
  } else {
    res.status(500).json({ error: 'Registration failed', detail: data })
  }
})

export default router
