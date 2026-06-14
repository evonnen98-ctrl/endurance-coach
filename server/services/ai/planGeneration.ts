import { addDays, format } from 'date-fns'
import type { UserContext } from '../userContext.js'
import { supabase } from '../../lib/supabase.js'

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

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

// ── Volume caps by goal + fitness level ───────────────────────────────────────

interface VolumeCap {
  run: number
  ride: number
  swim: number
  maxSessions: number
  sessionNote: string
}

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive'

function detectGoalType(goalType: string): string {
  const g = (goalType ?? '').toLowerCase()
  if (g.includes('ironman') && !g.includes('70.3') && !g.includes('half')) return 'ironman'
  if (g.includes('70.3') || (g.includes('half') && g.includes('iron'))) return '70.3'
  if (g.includes('olympic tri') || (g.includes('40km') && g.includes('swim'))) return 'olympic_tri'
  if (g.includes('sprint tri')) return 'sprint_tri'
  if (g.includes('marathon') && !g.includes('half')) return 'marathon'
  if (g.includes('half marathon') || g.includes('21km')) return 'half_marathon'
  if (g.includes('10km') || g.includes('10k')) return '10km'
  if (g.includes('5km') || g.includes('5k')) return '5km'
  if (g.includes('century') || g.includes('gran fondo') || g.includes('100km')) return 'century_ride'
  if (g.includes('maintain')) return 'maintain'
  return 'general'
}

function getCapsForGoal(level: FitnessLevel, goalRaw: string): VolumeCap {
  const goal = detectGoalType(goalRaw)

  const caps: Record<string, Partial<Record<FitnessLevel, VolumeCap>>> = {
    ironman: {
      intermediate: { run: 55,  ride: 250, swim: 12, maxSessions: 10, sessionNote: 'Max 10 sessions/week. One rest day mandatory.' },
      advanced:     { run: 65,  ride: 300, swim: 16, maxSessions: 12, sessionNote: 'Max 12 sessions/week. At least one full rest day.' },
      competitive:  { run: 75,  ride: 350, swim: 20, maxSessions: 14, sessionNote: 'High volume. No back-to-back long sessions.' },
    },
    '70.3': {
      beginner:     { run: 40,  ride: 140, swim: 6,  maxSessions: 8,  sessionNote: 'Max 8 sessions. Rest is training.' },
      intermediate: { run: 50,  ride: 180, swim: 10, maxSessions: 9,  sessionNote: 'Max 9 sessions/week. Hard/easy alternation.' },
      advanced:     { run: 60,  ride: 220, swim: 14, maxSessions: 10, sessionNote: 'Max 10 sessions. Never two hard days consecutive.' },
    },
    olympic_tri: {
      beginner:     { run: 25,  ride: 80,  swim: 4,  maxSessions: 6,  sessionNote: 'Max 6 sessions/week. One rest day minimum.' },
      intermediate: { run: 35,  ride: 120, swim: 7,  maxSessions: 7,  sessionNote: 'Max 7 sessions. Include one brick.' },
      advanced:     { run: 45,  ride: 150, swim: 10, maxSessions: 9,  sessionNote: 'Max 9 sessions. Hard/easy alternation.' },
    },
    sprint_tri: {
      beginner:     { run: 15,  ride: 60,  swim: 3,  maxSessions: 6,  sessionNote: 'Max 6 sessions. Build to race distance.' },
      intermediate: { run: 25,  ride: 80,  swim: 5,  maxSessions: 7,  sessionNote: 'Max 7 sessions. Include brick weekly.' },
      advanced:     { run: 35,  ride: 100, swim: 7,  maxSessions: 8,  sessionNote: 'Max 8 sessions. Two bricks per week max.' },
    },
    marathon: {
      beginner:     { run: 55,  ride: 0,   swim: 0,  maxSessions: 5,  sessionNote: '4-5 runs/week. Long run on preferred day.' },
      intermediate: { run: 70,  ride: 0,   swim: 0,  maxSessions: 6,  sessionNote: '5-6 runs/week. Easy running dominates (80%+).' },
      advanced:     { run: 85,  ride: 0,   swim: 0,  maxSessions: 7,  sessionNote: 'Up to 7 sessions. Include double-day max once/week.' },
    },
    half_marathon: {
      beginner:     { run: 40,  ride: 0,   swim: 0,  maxSessions: 4,  sessionNote: '4 runs/week. Easy base building.' },
      intermediate: { run: 55,  ride: 0,   swim: 0,  maxSessions: 5,  sessionNote: '5 runs/week. One quality session per week.' },
      advanced:     { run: 70,  ride: 0,   swim: 0,  maxSessions: 6,  sessionNote: '6 runs/week. Two quality sessions max.' },
    },
    '10km': {
      beginner:     { run: 25,  ride: 0,   swim: 0,  maxSessions: 4,  sessionNote: '3-4 runs/week. Gradual build.' },
      intermediate: { run: 40,  ride: 0,   swim: 0,  maxSessions: 5,  sessionNote: '4-5 runs/week. One interval session/week.' },
      advanced:     { run: 60,  ride: 0,   swim: 0,  maxSessions: 6,  sessionNote: '5-6 runs/week. Two quality sessions max.' },
    },
    '5km': {
      beginner:     { run: 20,  ride: 0,   swim: 0,  maxSessions: 3,  sessionNote: '3 runs/week. Build slowly.' },
      intermediate: { run: 35,  ride: 0,   swim: 0,  maxSessions: 4,  sessionNote: '4 runs/week. Mix easy and quality.' },
      advanced:     { run: 55,  ride: 0,   swim: 0,  maxSessions: 6,  sessionNote: 'Up to 6 runs/week. Sharpening phase.' },
    },
    century_ride: {
      beginner:     { run: 0,   ride: 150, swim: 0,  maxSessions: 4,  sessionNote: '3-4 rides/week. Long ride is key.' },
      intermediate: { run: 0,   ride: 220, swim: 0,  maxSessions: 5,  sessionNote: '4-5 rides/week. Sweet spot and long rides.' },
      advanced:     { run: 0,   ride: 300, swim: 0,  maxSessions: 6,  sessionNote: '5-6 rides/week. High volume endurance.' },
    },
    maintain: {
      beginner:     { run: 20,  ride: 60,  swim: 3,  maxSessions: 3,  sessionNote: '3 sessions max. No hard quality sessions.' },
      intermediate: { run: 30,  ride: 100, swim: 4,  maxSessions: 4,  sessionNote: '4 sessions max. Easy and moderate only.' },
      advanced:     { run: 40,  ride: 140, swim: 6,  maxSessions: 5,  sessionNote: '5 sessions max. Maintain fitness, no peaking.' },
      competitive:  { run: 50,  ride: 180, swim: 8,  maxSessions: 6,  sessionNote: '6 sessions. Maintenance volume.' },
    },
  }

  const fallback: Record<FitnessLevel, VolumeCap> = {
    beginner:     { run: 25,  ride: 80,  swim: 4,  maxSessions: 4,  sessionNote: 'Max 4 sessions. No two consecutive hard days.' },
    intermediate: { run: 35,  ride: 120, swim: 6,  maxSessions: 5,  sessionNote: 'Max 5 sessions. Hard/easy alternation.' },
    advanced:     { run: 50,  ride: 160, swim: 10, maxSessions: 6,  sessionNote: 'Max 6 sessions. Never two hard days back-to-back.' },
    competitive:  { run: 65,  ride: 200, swim: 15, maxSessions: 7,  sessionNote: 'High volume. Polarised approach.' },
  }

  return caps[goal]?.[level] ?? fallback[level] ?? fallback.intermediate
}

// ── BUG 5: Taper config by goal type ─────────────────────────────────────────
// Short events (5km, 10km): 1 taper week
// Medium events (HM, Olympic/Sprint tri): 2 taper weeks
// Long events (Marathon, 70.3, Ironman): 3 taper weeks, peak at W9

interface TaperConfig {
  multipliers: readonly number[]
  peakMultiplier: number
}

function getTaperConfig(goalRaw: string): TaperConfig {
  const goal = detectGoalType(goalRaw)

  if (goal === 'marathon' || goal === '70.3' || goal === 'ironman') {
    return {
      // Peak at W9 (×1.30), 3-week taper: W10=0.85, W11=0.70, W12=0.50
      multipliers:    [1.00, 1.05, 1.10, 0.85, 1.15, 1.20, 1.25, 0.90, 1.30, 0.85, 0.70, 0.50],
      peakMultiplier: 1.30,
    }
  }
  if (goal === 'half_marathon' || goal === 'olympic_tri' || goal === 'sprint_tri') {
    return {
      // Peak at W10 (×1.35), 2-week taper: W11=0.80, W12=0.55
      multipliers:    [1.00, 1.05, 1.10, 0.85, 1.15, 1.20, 1.25, 0.90, 1.30, 1.35, 0.80, 0.55],
      peakMultiplier: 1.35,
    }
  }
  // Default: 5km, 10km, century_ride, general, maintain — 1 taper week
  return {
    multipliers:    [1.00, 1.05, 1.10, 0.85, 1.15, 1.20, 1.25, 0.90, 1.30, 1.35, 1.15, 0.65],
    peakMultiplier: 1.35,
  }
}

// ── Day selection ─────────────────────────────────────────────────────────────
// Returns [preferredDayIdx, ...others] unsorted. Index 0 is always the primary (long) day.

function selectSessionDays(
  numSessions: number,
  preferredDayIdx: number,
  excludedIdxs: Set<number>,
): number[] {
  if (numSessions <= 0) return []

  let startDay = preferredDayIdx
  if (excludedIdxs.has(startDay)) {
    for (let offset = 1; offset <= 6; offset++) {
      const candidate = (preferredDayIdx + offset) % 7
      if (!excludedIdxs.has(candidate)) { startDay = candidate; break }
    }
  }

  const result: number[] = [startDay]

  for (let i = 1; i < numSessions; i++) {
    let bestDay = -1
    let bestScore = -1
    for (let d = 0; d < 7; d++) {
      if (excludedIdxs.has(d) || result.includes(d)) continue
      const minDist = Math.min(...result.map(r => {
        const diff = Math.abs(r - d)
        return Math.min(diff, 7 - diff)
      }))
      if (minDist > bestScore) { bestScore = minDist; bestDay = d }
    }
    if (bestDay !== -1) result.push(bestDay)
  }

  return result
}

// ── Base week construction ────────────────────────────────────────────────────

function buildBaseWeek(ctx: UserContext, taperConfig: TaperConfig): AiSession[] {
  const { disciplines, training_phase, preferences } = ctx.user
  const level       = ((preferences.fitness_level as string) ?? 'intermediate') as FitnessLevel
  const daysPerWeek = Math.min(Number(preferences.training_days_per_week) || 4, 7)
  const longDayRaw  = (preferences.preferred_long_day as string ?? 'Saturday')
  const longDayIdx  = DAY_INDEX[longDayRaw.toLowerCase()] ?? 5
  const isReturn    = training_phase === 'return'
  const goalType    = ctx.goal?.event_type ?? (preferences.goal_event_type as string ?? '')
  const caps        = getCapsForGoal(level, goalType)
  const startPct    = isReturn ? 0.60 : 0.90
  const { peakMultiplier } = taperConfig

  const maxQuality = (level === 'beginner' || isReturn) ? 0
    : level === 'intermediate' ? 1
    : 2

  // Week-1 km: 90% of current, capped so peak week never exceeds the goal cap
  function w1km(disc: string, cap: number): number {
    if (!disciplines.includes(disc) || cap === 0) return 0
    const cur = Number((preferences as Record<string, unknown>)[`${disc}_weekly_km`]) || 0
    const maxStart = cap / peakMultiplier
    if (cur > 0) return Math.min(cur * startPct, maxStart)
    return maxStart * 0.75
  }

  const runKmWeek  = w1km('run',  caps.run)
  const rideKmWeek = w1km('ride', caps.ride)
  const swimKmWeek = w1km('swim', caps.swim)

  // ── BUG 1: Compute session counts then clamp total to daysPerWeek ──────────
  // Trim swim first (least race-critical), then ride, then run.
  let numRun  = runKmWeek  > 0 ? (disciplines.length === 1 ? daysPerWeek : Math.max(2, Math.floor(daysPerWeek * 0.45))) : 0
  let numRide = rideKmWeek > 0 ? (disciplines.length === 1 ? daysPerWeek : Math.max(1, Math.round(daysPerWeek / disciplines.length))) : 0
  let numSwim = swimKmWeek > 0 ? Math.max(1, Math.round(daysPerWeek / disciplines.length)) : 0

  let overflow = (numRun + numRide + numSwim) - daysPerWeek
  if (overflow > 0) {
    const trimSwim = Math.min(overflow, Math.max(0, numSwim - 1))
    numSwim  -= trimSwim
    overflow -= trimSwim
  }
  if (overflow > 0) {
    const trimRide = Math.min(overflow, Math.max(0, numRide - 1))
    numRide  -= trimRide
    overflow -= trimRide
  }
  if (overflow > 0) {
    const trimRun = Math.min(overflow, Math.max(0, numRun - 1))
    numRun -= trimRun
  }

  console.log('[PLAN] Session counts:', { numRun, numRide, numSwim, total: numRun + numRide + numSwim, daysPerWeek })
  console.log('[PLAN] Week-1 volumes:', {
    run: runKmWeek.toFixed(1), ride: rideKmWeek.toFixed(1), swim: swimKmWeek.toFixed(1),
  })

  const sessions: AiSession[] = []
  const usedDays = new Set<number>()

  // ── RUN sessions ──────────────────────────────────────────────────────────
  if (numRun > 0 && runKmWeek > 0) {
    // BUG 2: When numRun=2, use 55/45 so long is always the longest session.
    //        When numRun≥3, use 40/60 spread across multiple shorter sessions.
    const longPct = numRun === 2 ? 0.55 : 0.40
    const longKm  = parseFloat((runKmWeek * longPct).toFixed(1))
    const restKm  = runKmWeek - longKm
    const numOther = numRun - 1
    const eachKm  = numOther > 0 ? parseFloat((restKm / numOther).toFixed(1)) : 0

    const runDayIdxs = selectSessionDays(numRun, longDayIdx, usedDays)
    runDayIdxs.forEach(d => usedDays.add(d))

    let qualityAdded = 0

    runDayIdxs.forEach((dayIdx, pos) => {
      const isLong = pos === 0

      if (isLong) {
        sessions.push({
          day:  ALL_DAYS[dayIdx],
          disc: 'run',
          type: 'long',
          km:   longKm,
          min:  Math.round(longKm * 7.0),
        })
      } else {
        const nonLongDone      = pos - 1
        const remainingNonLong = numOther - nonLongDone

        // BUG 3: Guard relaxed to numOther >= 1 so a 2-run plan (1 long + 1 other)
        //        can still assign a quality session for intermediate+ athletes.
        const canDoQuality = qualityAdded < maxQuality
          && remainingNonLong <= (maxQuality - qualityAdded + 1)
          && numOther >= 1

        const type = canDoQuality
          ? (qualityAdded === 0 ? 'tempo' : 'interval')
          : 'easy'
        if (canDoQuality) qualityAdded++

        // BUG 4: Vary session distance by type so they're not all identical.
        //        interval < tempo < easy, centred around eachKm average.
        const typeMultiplier = type === 'interval' ? 0.7 : type === 'tempo' ? 0.9 : 1.1
        const sessionKm = parseFloat((eachKm * typeMultiplier).toFixed(1))

        // BUG 6: Interval sessions under-report duration — add 20min for warmup/cooldown.
        const minPerKm = type === 'tempo' ? 5.5 : type === 'interval' ? 5.0 : 6.5
        const baseMins = Math.round(sessionKm * minPerKm)
        const mins     = type === 'interval' ? baseMins + 20 : baseMins

        sessions.push({
          day:  ALL_DAYS[dayIdx],
          disc: 'run',
          type,
          km:   sessionKm,
          min:  mins,
        })
      }
    })
  }

  // ── RIDE sessions ─────────────────────────────────────────────────────────
  if (numRide > 0 && rideKmWeek > 0) {
    const rideLongKm   = parseFloat((rideKmWeek * 0.55).toFixed(1))
    const numRideOther = numRide - 1
    const rideEachKm   = numRideOther > 0
      ? parseFloat(((rideKmWeek - rideLongKm) / numRideOther).toFixed(1))
      : 0

    const ridePrefIdx = disciplines.length === 1 ? longDayIdx : (longDayIdx + 2) % 7
    const rideDayIdxs = selectSessionDays(numRide, ridePrefIdx, usedDays)
    rideDayIdxs.forEach(d => usedDays.add(d))

    rideDayIdxs.forEach((dayIdx, pos) => {
      const isLong = pos === 0
      sessions.push({
        day:  ALL_DAYS[dayIdx],
        disc: 'ride',
        type: isLong ? 'long' : 'easy',
        km:   isLong ? rideLongKm : rideEachKm,
        min:  Math.round((isLong ? rideLongKm : rideEachKm) * 2.2),
      })
    })
  }

  // ── SWIM sessions ─────────────────────────────────────────────────────────
  if (numSwim > 0 && swimKmWeek > 0) {
    const swimEachKm = parseFloat((swimKmWeek / numSwim).toFixed(1))

    const swimPrefIdx = (longDayIdx + 3) % 7
    const swimDayIdxs = selectSessionDays(numSwim, swimPrefIdx, usedDays)
    swimDayIdxs.forEach(d => usedDays.add(d))

    swimDayIdxs.forEach((dayIdx, pos) => {
      sessions.push({
        day:  ALL_DAYS[dayIdx],
        disc: 'swim',
        type: pos === 0 ? 'base' : 'interval',
        km:   swimEachKm,
        min:  Math.round(swimEachKm * 30),
      })
    })
  }

  const sorted = sessions.sort((a, b) =>
    (DAY_INDEX[a.day.toLowerCase()] ?? 0) - (DAY_INDEX[b.day.toLowerCase()] ?? 0),
  )

  console.log('[PLAN] Base week:', sorted.map(s => `${s.day} ${s.disc} ${s.type} ${s.km}km`))
  console.log('[PLAN] Base week total km:', sorted.reduce((sum, s) => sum + s.km, 0).toFixed(1))

  return sorted
}

// ── 12-week expansion ─────────────────────────────────────────────────────────

function expandToTwelveWeeks(
  baseSessions: AiSession[],
  multipliers: readonly number[],
): Array<{ week: number; sessions: AiSession[] }> {
  return multipliers.map((mult, i) => ({
    week: i + 1,
    sessions: baseSessions.map(s => ({
      ...s,
      km:  parseFloat((s.km  * mult).toFixed(1)),
      min: Math.round(s.min * mult),
    })),
  }))
}

// ── DB row construction ───────────────────────────────────────────────────────

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

// ── Main entry point ──────────────────────────────────────────────────────────

export async function generatePlanSkeleton(
  userId: string,
  context: UserContext,
  onProgress?: (msg: string) => void,
): Promise<void> {
  console.log('[PLAN] USER CONTEXT FOR PLAN:', JSON.stringify({
    name:           context.user.name,
    disciplines:    context.user.disciplines,
    training_phase: context.user.training_phase,
    preferences:    context.user.preferences,
    goal:           context.goal,
  }, null, 2))
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

  onProgress?.('Building your plan…')

  const goalType   = context.goal?.event_type ?? (context.user.preferences.goal_event_type as string ?? '')
  const taperConfig = getTaperConfig(goalType)

  const baseSessions = buildBaseWeek(context, taperConfig)
  const allWeeks     = expandToTwelveWeeks(baseSessions, taperConfig.multipliers)
  const startDate    = new Date()

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
