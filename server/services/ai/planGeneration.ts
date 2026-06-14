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

// Closes a truncated JSON string by trimming the last incomplete item
// and adding the right number of closing brackets/braces.
function closeJson(text: string): string {
  // Strip trailing comma + partial content after last complete object
  const lastClose = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (lastClose === -1) return text
  let trimmed = text.slice(0, lastClose + 1)

  // Count unclosed delimiters
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

  // Close in reverse order of what was opened
  for (let i = 0; i < depth; i++) trimmed += (i === depth - 1 ? ']' : '}')
  return trimmed
}

const TYPE_TITLE: Record<string, string> = {
  easy: 'Easy', long: 'Long', tempo: 'Tempo', interval: 'Intervals',
  base: 'Base', drill: 'Drills', brick: 'Brick', recovery: 'Recovery', speed: 'Speed',
}

// Prompt asks for ONE week only — tiny response (~100 tokens), always completes
function buildPrompt(ctx: UserContext): string {
  const { disciplines, training_phase, preferences, coach_notes_freetext } = ctx.user
  const goal = ctx.goal

  const volume: string[] = []
  if (disciplines.includes('run')) {
    if (preferences.run_weekly_km)  volume.push(`run ${preferences.run_weekly_km}km/wk`)
    if (preferences.run_pace_easy)  volume.push(`easy pace ${preferences.run_pace_easy}/km`)
  }
  if (disciplines.includes('ride')) {
    if (preferences.ride_weekly_km) volume.push(`ride ${preferences.ride_weekly_km}km/wk`)
    if (preferences.ride_speed_kmh) volume.push(`${preferences.ride_speed_kmh}km/h`)
  }
  if (disciplines.includes('swim')) {
    if (preferences.swim_weekly_km) volume.push(`swim ${preferences.swim_weekly_km}km/wk`)
  }

  return `Endurance athlete needs a base training week.
Disciplines: ${disciplines.join('+')} | Phase: ${training_phase} | Goal: ${goal?.event_type ?? 'fitness'}
Volume: ${volume.length ? volume.join(', ') : 'beginner'}
Available days: ${(preferences.training_days as string | undefined) ?? 'flexible'}
Notes: ${coach_notes_freetext ?? 'none'}

Return ONLY this JSON (no markdown, no explanation):
{"sessions":[{"day":"Mon","disc":"run","type":"easy","km":8,"min":45},{"day":"Wed","disc":"run","type":"tempo","km":6,"min":40},{"day":"Sat","disc":"run","type":"long","km":14,"min":75}]}`
}

// Code builds 12 weeks from AI's base week using real periodisation phases
function expandToTwelveWeeks(baseSessions: AiSession[]): Array<{ week: number; sessions: AiSession[] }> {
  // Week multipliers: base → build → peak → taper
  const MULTIPLIERS = [
    1.00, 1.05, 1.10, 0.85, // weeks 1-4  (base block, recovery at 4)
    1.15, 1.20, 1.25, 0.90, // weeks 5-8  (build block, recovery at 8)
    1.30, 1.35, 1.15,        // weeks 9-11 (peak)
    0.65,                    // week 12    (taper)
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
  const { disciplines } = ctx.user
  const sessions: AiSession[] = []
  if (disciplines.includes('swim')) {
    sessions.push({ day: 'Mon', disc: 'swim', type: 'base',     km: 1.5, min: 40 })
    sessions.push({ day: 'Thu', disc: 'swim', type: 'interval', km: 2.0, min: 45 })
  }
  if (disciplines.includes('ride')) {
    sessions.push({ day: 'Tue', disc: 'ride', type: 'easy', km: 30, min: 60 })
    sessions.push({ day: 'Sat', disc: 'ride', type: 'long', km: 50, min: 90 })
  }
  if (disciplines.includes('run')) {
    sessions.push({ day: 'Wed', disc: 'run', type: 'easy', km: 8,  min: 45 })
    sessions.push({ day: 'Sun', disc: 'run', type: 'long', km: 12, min: 70 })
  }
  return sessions
}

function sessionsToRows(
  planId: string,
  userId: string,
  weeks: Array<{ week: number; sessions: AiSession[] }>,
  startDate: Date,
) {
  return weeks.flatMap(({ week, sessions }) =>
    sessions
      .map(s => {
        const dow = DAY_INDEX[s.day?.toLowerCase?.()]
        if (dow === undefined) return null
        const disc     = s.disc ?? 'run'
        const typeKey  = (s.type ?? 'easy').toLowerCase()
        const label    = TYPE_TITLE[typeKey] ?? s.type ?? 'Training'
        const discCap  = disc.charAt(0).toUpperCase() + disc.slice(1)
        return {
          plan_id:          planId,
          user_id:          userId,
          week_number:      week,
          day_of_week:      dow,
          scheduled_date:   format(addDays(startDate, (week - 1) * 7 + dow), 'yyyy-MM-dd'),
          discipline:       disc,
          session_type:     typeKey,
          title:            `${label} ${discCap}`,
          duration_minutes: Number(s.min) || 60,
          distance_km:      Number(s.km)  || null,
          status:           'planned',
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

    // Prefill assistant message so model only generates the array contents.
    // Model outputs e.g.: {"day":"Mon","disc":"run",...},{"day":"Wed",...}]}
    // We prepend PREFILL and close the JSON ourselves.
    const stream = client.messages.stream(
      {
        model:      MODEL,
        max_tokens: 300,
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

    // The full JSON is: PREFILL + continuation
    // continuation ends like: {...},{"day":"Sun",...}]}
    // We close any unclosed array/object if the model stopped early
    const fullText = PREFILL + continuation
    const closedText = closeJson(fullText)

    const parsed = JSON.parse(closedText) as { sessions: AiSession[] }
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

  const rows = sessionsToRows(plan.id, userId, allWeeks, startDate)
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
