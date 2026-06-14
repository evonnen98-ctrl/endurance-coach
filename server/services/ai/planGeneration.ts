import Anthropic from '@anthropic-ai/sdk'
import { addDays, format } from 'date-fns'
import type { UserContext } from '../userContext.js'
import { supabase } from '../../lib/supabase.js'

const client = new Anthropic()
const MODEL = 'claude-haiku-4-5-20251001'

const DAY_INDEX: Record<string, number> = {
  mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
  friday: 4, saturday: 5, sunday: 6,
}

interface AiSession {
  day: string
  disc: string
  type: string
  km: number
  min: number
}

function closeJson(text: string): string {
  const lastClose = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (lastClose === -1) return text
  let trimmed = text.slice(0, lastClose + 1)
  let depth = 0
  let inStr = false
  let esc = false
  for (const c of trimmed) {
    if (esc)              { esc = false; continue }
    if (c === '\\' && inStr) { esc = true; continue }
    if (c === '"')           { inStr = !inStr; continue }
    if (inStr) continue
    if (c === '{' || c === '[') depth++
    else if (c === '}' || c === ']') depth--
  }
  for (let i = 0; i < depth; i++) trimmed += (i === depth - 1 ? ']' : '}')
  return trimmed
}

// ── Effort zones ──────────────────────────────────────────────────────────────

const EFFORT_ZONES: Record<string, string> = {
  easy: 'Zone 2', long: 'Zone 2', base: 'Zone 2', drill: 'Zone 2',
  recovery: 'Zone 1',
  tempo: 'Zone 3-4',
  interval: 'Zone 4-5', speed: 'Zone 4-5',
  brick: 'Zone 2-3',
}

// ── Target pace computation ───────────────────────────────────────────────────

function parsePaceSec(pace: string): number {
  const parts = pace.split(':').map(s => parseInt(s, 10))
  if (parts.length !== 2 || parts.some(isNaN)) return 360
  return parts[0] * 60 + parts[1]
}

function formatPace(sec: number): string {
  const s = Math.max(0, sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function computeTargetPace(disc: string, type: string, prefs: Record<string, string | number>): string | null {
  if (disc === 'run') {
    const raw = prefs.run_pace_easy as string | undefined
    if (!raw) return null
    const sec = parsePaceSec(raw)
    if (type === 'easy' || type === 'long' || type === 'base' || type === 'recovery') return `${raw}/km`
    if (type === 'tempo') return `${formatPace(sec - 45)}/km`
    if (type === 'interval' || type === 'speed') return `${formatPace(sec - 75)}/km`
  }
  if (disc === 'ride') {
    const speed = Number(prefs.ride_speed_kmh)
    if (!speed) return null
    if (type === 'easy' || type === 'long' || type === 'base' || type === 'recovery') return `${speed - 2}–${speed} km/h`
    if (type === 'tempo') return `${speed}–${speed + 3} km/h`
    if (type === 'interval') return `${speed + 3}–${speed + 7} km/h`
  }
  if (disc === 'swim') {
    const raw = prefs.swim_pace_per_100m as string | undefined
    if (!raw) return null
    const sec = parsePaceSec(raw)
    if (type === 'base' || type === 'easy' || type === 'long') return `${raw}/100m`
    if (type === 'interval' || type === 'drill') return `${formatPace(sec - 10)}/100m`
  }
  return null
}

// ── Session description and structure ────────────────────────────────────────

function buildDescription(disc: string, type: string, km: number, targetPace: string | null): string {
  const pace = targetPace ? ` @ ${targetPace}` : ''
  if (disc === 'swim') {
    const totalM = Math.round(km * 1000)
    const mainM = Math.max(200, totalM - 600)
    if (type === 'interval' || type === 'drill') {
      const reps = Math.max(4, Math.round(mainM / 100))
      return `400m warm-up + ${reps}×100m${pace} with 20s rest + 200m cool-down = ${totalM}m total`
    }
    return `400m warm-up + ${mainM}m steady${pace} + 200m cool-down = ${totalM}m total`
  }
  if (disc === 'run') {
    if (type === 'interval' || type === 'speed') {
      const reps = km <= 8 ? 6 : 8
      const repDist = km <= 8 ? '400m' : '800m'
      return `10min warm-up + ${reps}×${repDist}${pace} with 90s recovery + 10min cool-down`
    }
    if (type === 'tempo') {
      const mainKm = parseFloat((km * 0.65).toFixed(1))
      return `10min easy warm-up + ${mainKm}km tempo${pace} + 10min cool-down`
    }
    return `${km}km easy${pace} — conversational pace throughout`
  }
  if (disc === 'ride') {
    if (type === 'interval') {
      return `15min warm-up + 4×8min intervals${pace} with 4min recovery + 10min cool-down`
    }
    if (type === 'tempo') {
      const mainKm = Math.round(km * 0.6)
      return `15min warm-up + ${mainKm}km tempo${pace} + 10min cool-down`
    }
    return `${km}km${pace} — steady aerobic effort, stay in zone`
  }
  if (disc === 'brick') {
    return `${Math.round(km * 0.8)}km ride then straight into a ${Math.round(km * 0.2 * 5)}min run — practice T2 transition`
  }
  return `${km > 0 ? km + 'km ' : ''}${type}`
}

function buildStructure(disc: string, type: string, km: number, targetPace: string | null): Array<{ description: string }> {
  const full = buildDescription(disc, type, km, targetPace)
  const parts = full.split(' + ').map(p => ({ description: p.trim() }))
  return parts.length > 1 ? parts : [{ description: full }]
}

// ── Coaching rationale ────────────────────────────────────────────────────────

const RATIONALE: Record<string, Record<string, string>> = {
  run: {
    easy:     'Aerobic base — keep it conversational. These easy kilometres build your engine without taxing recovery.',
    long:     'Your weekly cornerstone. Time on feet at easy effort builds fat metabolism and mitochondrial density.',
    tempo:    'Lactate threshold work. Pushing this ceiling is what makes race pace feel easier over time.',
    interval: 'VO2max stimulus — short hard efforts with full recovery. This is where real speed is built.',
    speed:    'Neuromuscular work — sharpens turnover and running economy. Hit target pace from the first rep.',
    recovery: 'Active recovery only — blood flow, not stress. If it feels hard, you\'re going too fast.',
    base:     'Foundation run — consistent easy aerobic stimulus builds the base everything else sits on.',
  },
  ride: {
    easy:     'Zone 2 ride — aerobic base without fatigue cost. Conversation pace throughout.',
    long:     'Endurance cornerstone. Long time in the saddle at steady Zone 2 trains fat as fuel.',
    tempo:    'Sweet spot work — highest aerobic stimulus per hour without deep fatigue accumulation.',
    interval: 'High-intensity efforts — lifts your functional threshold and VO2max ceiling.',
    base:     'Foundation ride — consistent aerobic work. Keep watts steady and cadence up.',
    recovery: 'Recovery spin — easy legs. This session helps, but only if you keep it genuinely easy.',
  },
  swim: {
    base:     'Aerobic swim base — smooth stroke, steady effort. Focus on form, not pace.',
    interval: 'Speed work in the water — high effort per interval, full rest between. Aim to hold pace across all reps.',
    drill:    'Technique session — drill sets lock in efficiency gains that last. Don\'t rush them.',
    easy:     'Recovery swim — active recovery. Keep stroke long, relaxed.',
    long:     'Distance swim — builds open-water confidence and endurance. Settle into a rhythm.',
  },
  brick: {
    brick: 'Brick session — ride then run with no break. Teaches your legs to switch modes, key for triathlon.',
  },
}

const TYPE_TITLE: Record<string, string> = {
  easy: 'Easy', long: 'Long', tempo: 'Tempo', interval: 'Intervals',
  base: 'Base', drill: 'Drills', brick: 'Brick', recovery: 'Recovery', speed: 'Speed',
}

// ── Volume caps per fitness level ─────────────────────────────────────────────

interface VolumeCap {
  run: number   // max weekly km
  ride: number
  swim: number
  sessionNote: string
}

const VOLUME_CAPS: Record<string, VolumeCap> = {
  beginner:     { run: 25,  ride: 80,  swim: 4,  sessionNote: 'No back-to-back hard sessions. Max 1 hard session per discipline per week.' },
  intermediate: { run: 35,  ride: 120, swim: 6,  sessionNote: 'Max one hard session per discipline. One easy/recovery day between hard days.' },
  advanced:     { run: 50,  ride: 160, swim: 10, sessionNote: 'Max two hard sessions per discipline. Never two hard days back-to-back.' },
  competitive:  { run: 65,  ride: 200, swim: 15, sessionNote: 'High volume, polarised. Never two consecutive hard sessions.' },
}

// ── Prompt & expansion ────────────────────────────────────────────────────────

function buildPrompt(ctx: UserContext): string {
  const { disciplines, training_phase, preferences, coach_notes_freetext, name } = ctx.user
  const goal = ctx.goal

  const fitnessLevel = (preferences.fitness_level as string) ?? 'intermediate'
  const daysPerWeek  = Number(preferences.training_days_per_week) || 4
  const caps         = VOLUME_CAPS[fitnessLevel] ?? VOLUME_CAPS.intermediate

  // Current volumes — clamp starting volumes to cap
  const curRun  = preferences.run_weekly_km  ? Math.min(Number(preferences.run_weekly_km),  caps.run)  : Math.round(caps.run  * 0.55)
  const curRide = preferences.ride_weekly_km ? Math.min(Number(preferences.ride_weekly_km), caps.ride) : Math.round(caps.ride * 0.55)
  const curSwim = preferences.swim_weekly_km ? Math.min(Number(preferences.swim_weekly_km), caps.swim) : Math.round(caps.swim * 0.55)

  const goalLine = goal
    ? `${goal.event_type ?? 'fitness goal'} on ${goal.target_date ?? 'no set date'}`
    : 'general fitness'

  const paceLines: string[] = []
  if (disciplines.includes('run')  && preferences.run_pace_easy)  paceLines.push(`Run easy pace: ${preferences.run_pace_easy}/km`)
  if (disciplines.includes('ride') && preferences.ride_speed_kmh) paceLines.push(`Ride avg speed: ${preferences.ride_speed_kmh} km/h`)
  if (disciplines.includes('swim') && preferences.swim_pace_per_100m) paceLines.push(`Swim comfortable pace: ${preferences.swim_pace_per_100m}/100m`)

  const brickNote = disciplines.length > 1
    ? '\n- Include ONE brick session (ride then run on the same day) for triathlon transition practice.'
    : ''

  return `ATHLETE PROFILE:
Name: ${name ?? 'Athlete'}
Fitness level: ${fitnessLevel}
Training phase: ${training_phase}
Disciplines: ${disciplines.join(' + ')}
Goal: ${goalLine}
Training days available: ${daysPerWeek} days/week
Preferred days: ${(preferences.training_days as string | undefined) ?? 'flexible'}
${paceLines.length ? '\nCURRENT PACES:\n' + paceLines.join('\n') : ''}
Coach notes: ${coach_notes_freetext ?? 'none'}

HARD CONSTRAINTS — NEVER EXCEED:
- Maximum ${daysPerWeek} sessions total per week (one session per day unless brick)
${disciplines.includes('run')  ? `- Run: week-1 volume MUST be exactly ${curRun}km. Hard cap: ${caps.run}km/week.` : ''}
${disciplines.includes('ride') ? `- Ride: week-1 volume MUST be exactly ${curRide}km. Hard cap: ${caps.ride}km/week.` : ''}
${disciplines.includes('swim') ? `- Swim: week-1 volume MUST be exactly ${curSwim}km. Hard cap: ${caps.swim}km/week.` : ''}
- ${caps.sessionNote}
- Never schedule two hard sessions (tempo/interval/speed) on consecutive days${brickNote}

INSTRUCTIONS:
Generate exactly ONE base training week with ${daysPerWeek} or fewer sessions.
Use varied session types: easy, tempo, interval, long — appropriate for ${fitnessLevel} level.
Volumes must be realistic for week 1 of a 12-week build.

Return ONLY this JSON (no markdown, no explanation):
{"sessions":[{"day":"Mon","disc":"run","type":"easy","km":8,"min":45},{"day":"Wed","disc":"run","type":"tempo","km":6,"min":40},{"day":"Fri","disc":"run","type":"interval","km":7,"min":50},{"day":"Sun","disc":"run","type":"long","km":14,"min":75}]}`
}

function expandToTwelveWeeks(baseSessions: AiSession[]): Array<{ week: number; sessions: AiSession[] }> {
  const MULTIPLIERS = [
    1.00, 1.05, 1.10, 0.85,
    1.15, 1.20, 1.25, 0.90,
    1.30, 1.35, 1.15,
    0.65,
  ]
  return MULTIPLIERS.map((mult, i) => ({
    week: i + 1,
    sessions: baseSessions.map(s => ({
      ...s,
      km:  parseFloat((s.km  * mult).toFixed(1)),
      min: Math.round(s.min * mult),
    })),
  }))
}

function hardcodedSessions(ctx: UserContext): AiSession[] {
  const { disciplines, preferences } = ctx.user
  const fitnessLevel = (preferences.fitness_level as string) ?? 'intermediate'
  const caps = VOLUME_CAPS[fitnessLevel] ?? VOLUME_CAPS.intermediate

  // Scale fallback sessions to ~55% of the weekly cap for week 1
  const runStart  = Math.round(caps.run  * 0.55)
  const rideStart = Math.round(caps.ride * 0.55)
  const swimStart = parseFloat((caps.swim * 0.55).toFixed(1))

  const sessions: AiSession[] = []
  if (disciplines.includes('swim')) {
    sessions.push({ day: 'Mon', disc: 'swim', type: 'base',     km: parseFloat((swimStart * 0.45).toFixed(1)), min: 35 })
    sessions.push({ day: 'Thu', disc: 'swim', type: 'interval', km: parseFloat((swimStart * 0.55).toFixed(1)), min: 40 })
  }
  if (disciplines.includes('ride')) {
    sessions.push({ day: 'Tue', disc: 'ride', type: 'easy', km: Math.round(rideStart * 0.45), min: 55 })
    sessions.push({ day: 'Sat', disc: 'ride', type: 'long', km: Math.round(rideStart * 0.55), min: 80 })
  }
  if (disciplines.includes('run')) {
    sessions.push({ day: 'Wed', disc: 'run',  type: 'easy',  km: Math.round(runStart * 0.35), min: 40 })
    sessions.push({ day: 'Fri', disc: 'run',  type: 'tempo', km: Math.round(runStart * 0.25), min: 35 })
    sessions.push({ day: 'Sun', disc: 'run',  type: 'long',  km: Math.round(runStart * 0.40), min: 65 })
  }
  return sessions
}

function sessionsToRows(
  planId: string,
  userId: string,
  weeks: Array<{ week: number; sessions: AiSession[] }>,
  startDate: Date,
  prefs: Record<string, string | number>,
) {
  return weeks.flatMap(({ week, sessions }) =>
    sessions
      .map(s => {
        const dow = DAY_INDEX[s.day?.toLowerCase?.()]
        if (dow === undefined) return null
        const disc    = s.disc ?? 'run'
        const typeKey = (s.type ?? 'easy').toLowerCase()
        const label   = TYPE_TITLE[typeKey] ?? s.type ?? 'Training'
        const discCap = disc.charAt(0).toUpperCase() + disc.slice(1)
        const targetPace = computeTargetPace(disc, typeKey, prefs)
        const effortZone = EFFORT_ZONES[typeKey] ?? 'Zone 2'
        const description = buildDescription(disc, typeKey, Number(s.km) || 5, targetPace)
        const structure   = buildStructure(disc, typeKey, Number(s.km) || 5, targetPace)
        const rationale   = RATIONALE[disc]?.[typeKey] ?? `${label} session — builds specific fitness for your goal.`
        return {
          plan_id:            planId,
          user_id:            userId,
          week_number:        week,
          day_of_week:        dow,
          scheduled_date:     format(addDays(startDate, (week - 1) * 7 + dow), 'yyyy-MM-dd'),
          discipline:         disc,
          session_type:       typeKey,
          title:              `${label} ${discCap}`,
          description,
          session_structure:  structure,
          coaching_rationale: rationale,
          effort_zone:        effortZone,
          target_pace:        targetPace,
          duration_minutes:   Number(s.min) || 60,
          distance_km:        Number(s.km)  || null,
          status:             'planned',
        }
      })
      .filter(Boolean)
  )
}

export async function generatePlanSkeleton(
  userId: string,
  context: UserContext,
  onProgress?: (msg: string) => void,
): Promise<void> {
  console.log('[PLAN] Start:', Date.now())

  const { data: existing } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (existing) {
    console.log('[PLAN] Active plan exists — skipping')
    return
  }

  console.log('[PLAN] Context built:', Date.now())
  onProgress?.('Building your plan…')

  let baseSessions: AiSession[] | null = null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  const PREFILL = '{"sessions":['

  try {
    console.log('[PLAN] AI call start:', Date.now())
    const stream = client.messages.stream(
      {
        model:      MODEL,
        max_tokens: 400,
        system:     'You are an endurance coach. Return only valid JSON, no markdown or explanation.',
        messages:   [
          { role: 'user',      content: buildPrompt(context) },
          { role: 'assistant', content: PREFILL },
        ],
      },
      { signal: controller.signal },
    )

    const continuation = await stream.finalText()
    console.log('[PLAN] AI call end:', Date.now())

    const fullText   = PREFILL + continuation
    const closedText = closeJson(fullText)
    const parsed     = JSON.parse(closedText) as { sessions: AiSession[] }
    if (Array.isArray(parsed.sessions) && parsed.sessions.length > 0) {
      baseSessions = parsed.sessions
      console.log(`[PLAN] AI returned ${baseSessions.length} base sessions`)
    }
  } catch (err: any) {
    if (controller.signal.aborted) {
      console.warn('[PLAN] AI timed out — using hardcoded base week')
    } else {
      console.error('[PLAN] AI error:', err.message)
    }
  } finally {
    clearTimeout(timeout)
  }

  if (!baseSessions) {
    console.log('[PLAN] Using hardcoded base week')
    baseSessions = hardcodedSessions(context)
  }

  const allWeeks  = expandToTwelveWeeks(baseSessions)
  const startDate = new Date()

  console.log('[PLAN] DB insert:', Date.now())

  const { data: plan } = await supabase
    .from('training_plans')
    .insert({
      user_id:     userId,
      start_date:  format(startDate, 'yyyy-MM-dd'),
      end_date:    format(addDays(startDate, 83), 'yyyy-MM-dd'),
      total_weeks: 12,
      status:      'active',
    })
    .select()
    .single()

  if (!plan) throw new Error('Failed to create training plan')

  const rows = sessionsToRows(plan.id, userId, allWeeks, startDate, context.user.preferences)
  if (rows.length > 0) {
    await supabase.from('sessions').insert(rows)
  }

  console.log('[PLAN] Done:', Date.now())
  console.log(`[PLAN] Inserted ${rows.length} sessions across 12 weeks`)
}

export async function generatePlan(userId: string, context: UserContext): Promise<void> {
  return generatePlanSkeleton(userId, context, undefined)
}

export async function startEnrichmentBackground(_userId: string, _context: UserContext): Promise<void> {
  // no-op
}
