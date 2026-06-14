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
      const mainKm = Math.round(km * 0.65)
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
  if (g.includes('ultra')) return 'marathon'
  if (g.includes('stage race')) return 'century_ride'
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

// ── Peak multiplier by goal ───────────────────────────────────────────────────

function peakMultiplierForGoal(goalRaw: string): number {
  const g = detectGoalType(goalRaw)
  return (g === 'marathon' || g === '70.3' || g === 'ironman') ? 1.30 : 1.35
}

// ── Race-adaptive plan timing ─────────────────────────────────────────────────

type PlanPhase = 'base_block' | 'full' | 'compressed' | 'race_prep' | 'race_week'

interface PlanTiming {
  planWeeks:      number
  startDate:      Date
  phase:          PlanPhase
  userMessage:    string | null
  weeksUntilRace: number | null
}

function nextMonday(d: Date): Date {
  const day = d.getDay()
  if (day === 1) return new Date(d)
  const offset = day === 0 ? 1 : 8 - day
  const m = new Date(d)
  m.setDate(d.getDate() + offset)
  return m
}

function calculatePlanTiming(
  targetDate:           string | undefined | null,
  preferredStartDate:   string | undefined | null,
): PlanTiming {
  const today        = new Date()
  const defaultStart = preferredStartDate
    ? nextMonday(new Date(preferredStartDate + 'T12:00:00'))
    : nextMonday(today)

  if (!targetDate) {
    return { planWeeks: 12, startDate: defaultStart, phase: 'base_block', userMessage: null, weeksUntilRace: null }
  }

  const raceDate       = new Date(targetDate + 'T12:00:00')
  const msPerWeek      = 7 * 24 * 60 * 60 * 1000
  const weeksUntilRace = Math.floor((raceDate.getTime() - today.getTime()) / msPerWeek)

  if (weeksUntilRace > 16) {
    const blockStart = new Date(raceDate)
    blockStart.setDate(raceDate.getDate() - 84)
    const startMon = nextMonday(blockStart)
    return {
      planWeeks:      12,
      startDate:      startMon,
      phase:          'full',
      userMessage:    `Your race is ${weeksUntilRace} weeks away. We'll start your peak 12-week block on ${format(startMon, 'd MMM yyyy')}. Keep building your base until then.`,
      weeksUntilRace,
    }
  }
  if (weeksUntilRace >= 10) {
    return { planWeeks: weeksUntilRace, startDate: defaultStart, phase: 'full',       userMessage: null, weeksUntilRace }
  }
  if (weeksUntilRace >= 6) {
    return {
      planWeeks:      weeksUntilRace,
      startDate:      defaultStart,
      phase:          'compressed',
      userMessage:    `With ${weeksUntilRace} weeks to race day, we'll focus on race-specific preparation and skip the base phase.`,
      weeksUntilRace,
    }
  }
  if (weeksUntilRace >= 3) {
    return {
      planWeeks:      weeksUntilRace,
      startDate:      defaultStart,
      phase:          'race_prep',
      userMessage:    `Race day is close. This plan focuses on arriving fresh and confident — easy sessions, some race pace work, and smart tapering.`,
      weeksUntilRace,
    }
  }
  return {
    planWeeks:      Math.max(1, weeksUntilRace),
    startDate:      defaultStart,
    phase:          'race_week',
    userMessage:    `You're in race week territory. Focus on rest, nutrition, and race-day prep. Keep sessions short and easy.`,
    weeksUntilRace,
  }
}

// ── Volume multipliers scaled to plan length ──────────────────────────────────

function buildPlanMultipliers(
  planWeeks: number,
  goalType:  string,
  phase:     PlanPhase,
): { multipliers: number[]; peakMultiplier: number } {
  const goal       = detectGoalType(goalType)
  const isLong     = goal === 'marathon' || goal === '70.3' || goal === 'ironman'
  const peakMult   = isLong ? 1.30 : 1.35

  // Race week (1-2 weeks): flat easy
  if (planWeeks <= 2 || phase === 'race_week') {
    const mults = planWeeks <= 1 ? [0.55] : [0.75, 0.55]
    return { multipliers: mults.slice(0, planWeeks), peakMultiplier: peakMult }
  }

  // Race prep (3-5 weeks): maintain + taper, no real build
  if (phase === 'race_prep' || planWeeks <= 5) {
    const n = Math.min(planWeeks, 5)
    const patterns: Record<number, number[]> = {
      3: [0.90, 0.80, 0.55],
      4: [0.95, 0.90, 0.80, 0.55],
      5: [1.00, 0.95, 0.90, 0.80, 0.55],
    }
    return { multipliers: patterns[n] ?? [0.90, 0.80, 0.55], peakMultiplier: peakMult }
  }

  // Compressed (6-9 weeks): skip base, build straight to peak, 1 taper week
  if (phase === 'compressed' || planWeeks <= 9) {
    const n      = planWeeks
    const buildN = n - 1
    const mults: number[] = []
    for (let w = 0; w < buildN; w++) {
      const isRecovery = buildN >= 4 && (w + 1) % 3 === 0
      if (isRecovery) {
        mults.push(0.85)
      } else {
        const frac = w / Math.max(1, buildN - 1)
        mults.push(parseFloat((1.05 + frac * (peakMult - 1.05)).toFixed(2)))
      }
    }
    return { multipliers: [...mults, 0.65], peakMultiplier: peakMult }
  }

  // Full / base_block (10-12 weeks): standard canonical periodisation
  const canonical12: number[] = isLong
    ? [1.00, 1.05, 1.10, 0.85, 1.15, 1.20, 1.25, 0.90, 1.30, 0.85, 0.70, 0.50]
    : [1.00, 1.05, 1.10, 0.85, 1.15, 1.20, 1.25, 0.90, 1.30, 1.35, 0.80, 0.55]

  if (planWeeks >= 12) return { multipliers: canonical12, peakMultiplier: peakMult }

  // Compress canonical to planWeeks: keep taper intact, sample build weeks
  const taperN   = isLong ? 3 : 2
  const taperPart = canonical12.slice(-taperN)
  const buildPart = canonical12.slice(0, -taperN)
  const buildN    = planWeeks - taperN

  if (buildN <= 0) {
    return { multipliers: taperPart.slice(-planWeeks), peakMultiplier: peakMult }
  }

  const sampledBuild = Array.from({ length: buildN }, (_, i) => {
    const idx = Math.round(i * (buildPart.length - 1) / Math.max(1, buildN - 1))
    return buildPart[Math.min(idx, buildPart.length - 1)]
  })
  return { multipliers: [...sampledBuild, ...taperPart], peakMultiplier: peakMult }
}

// ── Training day helpers ──────────────────────────────────────────────────────

function parseTrainingDays(raw: string): number[] {
  if (!raw) return []
  const dayMap: Record<string, number> = {
    mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6,
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
  }
  return [...new Set(
    raw.split(',')
      .map(d => dayMap[d.trim().toLowerCase()])
      .filter((d): d is number => d !== undefined),
  )].sort((a, b) => a - b)
}

// Snap `day` to the nearest value in `allowed` (circular week)
function nearestAllowedDay(day: number, allowed: number[]): number {
  if (!allowed.length || allowed.includes(day)) return day
  return allowed.reduce((best, d) => {
    const dD = Math.min(Math.abs(d - day), 7 - Math.abs(d - day))
    const dB = Math.min(Math.abs(best - day), 7 - Math.abs(best - day))
    return dD < dB ? d : best
  }, allowed[0])
}

// Find allowed day closest FORWARD from anchor (for placing long ride after long run day)
function findAdjacentDay(anchor: number, allowed: number[]): number {
  const others = (allowed.length > 0 ? allowed : [0,1,2,3,4,5,6]).filter(d => d !== anchor)
  if (!others.length) return (anchor + 1) % 7
  return others.reduce((best, d) => {
    const fwdD    = (d    - anchor + 7) % 7
    const fwdBest = (best - anchor + 7) % 7
    return fwdD < fwdBest ? d : best
  }, others[0])
}

// ── Template-based weekly schedule ───────────────────────────────────────────
//
// preferred_long_day = the long RUN day (user's most important session).
// For multi-discipline athletes, long RIDE goes on the next allowed day after that.
// Sessions are only placed on days in allowedDays (if provided).

interface Slot {
  disc: 'run' | 'ride' | 'swim'
  type: string
  kmShare: number  // fraction of weekly km for this disc
  minPerKm: number // minutes per km (used for duration estimate)
}

type DisciplineSet = 'run' | 'ride' | 'swim' | 'run+ride' | 'run+swim' | 'ride+swim' | 'all'

function classifyDisciplines(disciplines: string[]): DisciplineSet {
  const hasRun  = disciplines.includes('run')
  const hasRide = disciplines.includes('ride')
  const hasSwim = disciplines.includes('swim')
  if (hasRun && hasRide && hasSwim) return 'all'
  if (hasRun && hasRide) return 'run+ride'
  if (hasRun && hasSwim) return 'run+swim'
  if (hasRide && hasSwim) return 'ride+swim'
  if (hasRun)  return 'run'
  if (hasRide) return 'ride'
  if (hasSwim) return 'swim'
  return 'run' // safe default
}

// Returns { day (0-6), slot } pairs for a given daysPerWeek + discipline set.
function buildWeekTemplate(
  daysPerWeek: number,
  discSet: DisciplineSet,
  longDayIdx: number,         // preferred day — long RUN lands here
  level: FitnessLevel,
  hasQuality: boolean,
  allowedDays: number[] = [], // empty = no restriction
): Array<{ dayIdx: number; slot: Slot }> {

  // Pool: the days we are allowed to use
  const pool = allowedDays.length > 0 ? allowedDays : [0,1,2,3,4,5,6]

  // Long RUN on preferred day; long RIDE on the next adjacent allowed day
  const longRunDay  = nearestAllowedDay(longDayIdx, pool)
  const longRideDay = findAdjacentDay(longRunDay, pool)

  // ----- Single discipline templates -----
  if (discSet === 'run' || discSet === 'ride' || discSet === 'swim') {
    const disc = discSet as 'run' | 'ride' | 'swim'
    const minPerKm = disc === 'run' ? 6.5 : disc === 'ride' ? 2.2 : 30

    // Place the long session on preferred day, spread others as far apart as possible
    const slots: Slot[] = []

    // Long session first
    slots.push({ disc, type: 'long', kmShare: 0, minPerKm })

    // Fill remaining sessions
    const n = daysPerWeek
    for (let i = 1; i < n; i++) {
      const isQuality = hasQuality && i === n - 1  // last non-long slot gets quality
      const isSecondQuality = hasQuality && i === n - 2 && level !== 'intermediate'
      const type = (isQuality || isSecondQuality) ? (i % 2 === 0 ? 'interval' : 'tempo') : 'easy'
      slots.push({ disc, type, kmShare: 0, minPerKm })
    }

    // Assign km shares: long gets longPct, rest split evenly
    const longPct = n === 2 ? 0.55 : n >= 4 ? 0.35 : 0.45
    slots[0].kmShare = longPct
    const restPct = (1 - longPct) / Math.max(1, n - 1)
    for (let i = 1; i < slots.length; i++) {
      const t = slots[i].type
      slots[i].kmShare = restPct * (t === 'interval' ? 0.7 : t === 'tempo' ? 0.9 : 1.1)
    }
    // Normalise so shares sum to 1
    const total = slots.reduce((s, sl) => s + sl.kmShare, 0)
    slots.forEach(sl => { sl.kmShare /= total })

    // Spread day indices across allowed days only, starting from longRunDay
    const dayIdxs = spreadDays(Math.min(n, pool.length), longRunDay, pool)
    return dayIdxs.map((dayIdx, i) => ({ dayIdx, slot: slots[i] }))
  }

  // ----- Multi-discipline templates -----
  const hasRun  = discSet === 'all' || discSet.startsWith('run')  || discSet.endsWith('run')
  const hasRide = discSet === 'all' || discSet.startsWith('ride') || discSet.endsWith('ride')
  const hasSwim = discSet === 'all' || discSet.startsWith('swim') || discSet.endsWith('swim')

  type Entry = { dayIdx: number; disc: 'run' | 'ride' | 'swim'; type: string; kmShare: number; minPerKm: number }
  const entries: Entry[] = []

  // longRunDay  = user's preferred long day (anchor A — long RUN)
  // longRideDay = next adjacent allowed day (anchor B — long RIDE)
  // nonAnchor   = all pool days except the two anchors

  const nonAnchor = pool.filter(d => d !== longRunDay && d !== longRideDay)

  if (daysPerWeek <= 3) {
    // 3 days: swim + long run + long ride (or what's available)
    const fillers = pickSpread(nonAnchor, 1, [longRunDay, longRideDay])
    if (hasSwim) entries.push({ dayIdx: fillers[0] ?? nonAnchor[0] ?? (longRunDay + 3) % 7, disc: 'swim', type: 'base', kmShare: 0, minPerKm: 30 })
    if (hasRide) entries.push({ dayIdx: longRideDay, disc: 'ride', type: 'long', kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: longRunDay,  disc: 'run',  type: 'long', kmShare: 0, minPerKm: 6.5 })
  } else if (daysPerWeek === 4) {
    const fillers = pickSpread(nonAnchor, 2, [longRunDay, longRideDay])
    if (hasSwim) entries.push({ dayIdx: fillers[0] ?? nonAnchor[0] ?? 0, disc: 'swim', type: 'base',  kmShare: 0, minPerKm: 30 })
    else if (hasRide) entries.push({ dayIdx: fillers[0] ?? nonAnchor[0] ?? 0, disc: 'ride', type: 'easy', kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: fillers[1] ?? nonAnchor[1] ?? 2, disc: 'run',  type: 'easy',  kmShare: 0, minPerKm: 6.5 })
    if (hasRide) entries.push({ dayIdx: longRideDay, disc: 'ride', type: 'long',  kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: longRunDay,  disc: 'run',  type: 'long',  kmShare: 0, minPerKm: 6.5 })
  } else if (daysPerWeek === 5) {
    const spread3 = pickSpread(nonAnchor, 3, [longRunDay, longRideDay])
    if (hasSwim) {
      entries.push({ dayIdx: spread3[0] ?? nonAnchor[0] ?? 0, disc: 'swim', type: 'base',     kmShare: 0, minPerKm: 30 })
      entries.push({ dayIdx: spread3[2] ?? nonAnchor[2] ?? 2, disc: 'swim', type: 'interval', kmShare: 0, minPerKm: 30 })
    } else if (hasRun) {
      entries.push({ dayIdx: spread3[0] ?? nonAnchor[0] ?? 0, disc: 'run', type: 'easy',  kmShare: 0, minPerKm: 6.5 })
      entries.push({ dayIdx: spread3[2] ?? nonAnchor[2] ?? 2, disc: 'run', type: hasQuality ? 'tempo' : 'easy', kmShare: 0, minPerKm: 5.5 })
    }
    if (hasRun)  entries.push({ dayIdx: spread3[1] ?? nonAnchor[1] ?? 1, disc: 'run',  type: 'easy', kmShare: 0, minPerKm: 6.5 })
    if (hasRide) entries.push({ dayIdx: longRideDay, disc: 'ride', type: 'long', kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: longRunDay,  disc: 'run',  type: 'long', kmShare: 0, minPerKm: 6.5 })
  } else {
    // 6+ days: full week
    const spread4 = pickSpread(nonAnchor, 4, [longRunDay, longRideDay])
    if (hasSwim) {
      entries.push({ dayIdx: spread4[0] ?? nonAnchor[0] ?? 0, disc: 'swim', type: 'base',     kmShare: 0, minPerKm: 30 })
      entries.push({ dayIdx: spread4[3] ?? nonAnchor[3] ?? 3, disc: 'swim', type: 'interval', kmShare: 0, minPerKm: 30 })
    }
    if (hasRun) {
      entries.push({ dayIdx: spread4[1] ?? nonAnchor[1] ?? 1, disc: 'run', type: 'easy',  kmShare: 0, minPerKm: 6.5 })
      entries.push({ dayIdx: spread4[2] ?? nonAnchor[2] ?? 2, disc: 'run', type: hasQuality ? 'tempo' : 'easy', kmShare: 0, minPerKm: 5.5 })
    }
    if (hasRide) entries.push({ dayIdx: longRideDay, disc: 'ride', type: 'long', kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: longRunDay,  disc: 'run',  type: 'long', kmShare: 0, minPerKm: 6.5 })

    // Add non-long ride if there's still a free allowed day
    const used = new Set(entries.map(e => e.dayIdx))
    if (hasRide && entries.length < Math.min(daysPerWeek, pool.length)) {
      const rideDay = nonAnchor.find(d => !used.has(d))
      if (rideDay !== undefined) {
        entries.push({ dayIdx: rideDay, disc: 'ride', type: hasQuality ? 'tempo' : 'easy', kmShare: 0, minPerKm: 2.2 })
      }
    }
  }

  // Remove duplicate disciplines on same day (keep first occurrence — should not happen with templates but be safe)
  const seen = new Map<string, boolean>()
  const deduped = entries.filter(e => {
    const key = `${e.dayIdx}-${e.disc}`
    if (seen.has(key)) return false
    seen.set(key, true)
    return true
  })

  // Assign km shares per discipline
  const runEntries  = deduped.filter(e => e.disc === 'run')
  const rideEntries = deduped.filter(e => e.disc === 'ride')
  const swimEntries = deduped.filter(e => e.disc === 'swim')

  assignShares(runEntries)
  assignShares(rideEntries)
  assignShares(swimEntries)

  return deduped.map(e => ({ dayIdx: e.dayIdx, slot: { disc: e.disc, type: e.type, kmShare: e.kmShare, minPerKm: e.minPerKm } }))
}

// Assign km shares within a set of same-discipline slots
function assignShares(entries: Array<{ type: string; kmShare: number }>) {
  if (entries.length === 0) return
  const weights = entries.map(e => e.type === 'long' ? 2.0 : e.type === 'tempo' ? 0.9 : e.type === 'interval' ? 0.7 : 1.0)
  const total = weights.reduce((s, w) => s + w, 0)
  entries.forEach((e, i) => { e.kmShare = weights[i] / total })
}

// Spread n days starting from preferred, maximally separated; respects allowed days pool
function spreadDays(n: number, preferred: number, pool: number[] = [0,1,2,3,4,5,6]): number[] {
  const anchor = nearestAllowedDay(preferred, pool)
  const result: number[] = [anchor]
  const remaining = pool.filter(d => d !== anchor)
  while (result.length < n && remaining.length > 0) {
    let best = remaining[0], bestScore = -1
    for (const d of remaining) {
      const minDist = Math.min(...result.map(r => {
        const diff = Math.abs(r - d)
        return Math.min(diff, 7 - diff)
      }))
      if (minDist > bestScore) { bestScore = minDist; best = d }
    }
    result.push(best)
    remaining.splice(remaining.indexOf(best), 1)
  }
  return result
}

// Pick `n` days from `candidates`, maximally spread from `anchors`
function pickSpread(candidates: number[], n: number, anchors: number[]): number[] {
  const result: number[] = []
  const avoid = new Set([...anchors])
  for (let i = 0; i < n && candidates.length > 0; i++) {
    let best = candidates[0], bestScore = -1
    for (const d of candidates) {
      if (avoid.has(d)) continue
      const minDist = Math.min(...[...avoid].map(r => {
        const diff = Math.abs(r - d); return Math.min(diff, 7 - diff)
      }))
      if (minDist > bestScore) { bestScore = minDist; best = d }
    }
    result.push(best)
    avoid.add(best)
  }
  return result
}

// ── Base week construction ────────────────────────────────────────────────────

function buildBaseWeek(ctx: UserContext, peakMultiplier: number, phase: PlanPhase): AiSession[] {
  const { disciplines, training_phase, preferences } = ctx.user

  // Discipline filtering — ONLY create sessions for athlete's chosen disciplines
  const allowedDiscs = new Set(disciplines.filter(d => ['run', 'ride', 'swim'].includes(d)))
  if (allowedDiscs.size === 0) allowedDiscs.add('run') // safe default

  const level       = ((preferences.fitness_level as string) ?? 'intermediate') as FitnessLevel
  const daysPerWeek = Math.min(Number(preferences.training_days_per_week) || 4, 7)
  const longDayRaw  = (preferences.preferred_long_day as string ?? 'Saturday')
  const rawLongIdx  = DAY_INDEX[longDayRaw.toLowerCase()] ?? 5

  // Parse the specific days the user is available to train
  const allowedDays = parseTrainingDays(preferences.training_days as string ?? '')
  const longDayIdx  = allowedDays.length > 0 ? nearestAllowedDay(rawLongIdx, allowedDays) : rawLongIdx

  const isReturn    = training_phase === 'return'
  const goalType    = ctx.goal?.event_type ?? (preferences.goal_event_type as string ?? '')
  const caps        = getCapsForGoal(level, goalType)
  const startPct    = isReturn ? 0.60 : 0.90

  // No quality sessions during race week or race prep phases
  const hasQuality = level !== 'beginner' && !isReturn
    && phase !== 'race_week' && phase !== 'race_prep'

  // Week-1 km per discipline, capped so peak never exceeds goal cap
  function w1km(disc: string, cap: number): number {
    if (!allowedDiscs.has(disc) || cap === 0) return 0
    const cur = Number((preferences as Record<string, unknown>)[`${disc}_weekly_km`]) || 0
    const maxStart = cap / peakMultiplier
    if (cur > 0) return Math.min(cur * startPct, maxStart)
    return maxStart * 0.75
  }

  const runKmWeek  = w1km('run',  caps.run)
  const rideKmWeek = w1km('ride', caps.ride)
  const swimKmWeek = w1km('swim', caps.swim)

  console.log('[PLAN] ── VOLUME DIAGNOSTICS ──')
  console.log('[PLAN] FITNESS_LEVEL:     ', level, ' (raw pref:', preferences.fitness_level, ')')
  console.log('[PLAN] TRAINING_DAYS:     ', daysPerWeek, ' (raw pref:', preferences.training_days_per_week, ')')
  console.log('[PLAN] ALLOWED_DISCS:     ', [...allowedDiscs])
  console.log('[PLAN] CURRENT_VOLUMES:   ', {
    run:  Number((preferences as Record<string, unknown>).run_weekly_km)  || 0,
    ride: Number((preferences as Record<string, unknown>).ride_weekly_km) || 0,
    swim: Number((preferences as Record<string, unknown>).swim_weekly_km) || 0,
  })
  console.log('[PLAN] GOAL:              ', goalType, '→ detected:', detectGoalType(goalType))
  console.log('[PLAN] CAPS_USED:         ', caps)
  console.log('[PLAN] W1_VOLUMES:        ', { run: runKmWeek.toFixed(1), ride: rideKmWeek.toFixed(1), swim: swimKmWeek.toFixed(1) })
  console.log('[PLAN] ─────────────────────────')

  const discSet = classifyDisciplines([...allowedDiscs])
  const template = buildWeekTemplate(daysPerWeek, discSet, longDayIdx, level, hasQuality, allowedDays)
  console.log('[PLAN] ALLOWED_DAYS:      ', allowedDays.length > 0 ? allowedDays.map(d => ALL_DAYS[d]) : 'all')
  console.log('[PLAN] LONG_RUN_DAY:      ', ALL_DAYS[longDayIdx])

  const sessions: AiSession[] = []

  for (const { dayIdx, slot } of template) {
    const { disc, type, kmShare, minPerKm } = slot

    // Skip if discipline not allowed (belt-and-suspenders after template)
    if (!allowedDiscs.has(disc)) continue

    const weeklyKm = disc === 'run' ? runKmWeek : disc === 'ride' ? rideKmWeek : swimKmWeek
    if (weeklyKm <= 0) continue

    const rawKm  = weeklyKm * kmShare
    const km     = Math.max(1, Math.round(rawKm))

    const baseMin = disc === 'run'
      ? Math.round(km * (type === 'interval' ? 5.0 : type === 'tempo' ? 5.5 : 6.5))
      : disc === 'ride'
        ? Math.round(km * 2.2)
        : Math.round(km * 30)

    const min = type === 'interval' ? baseMin + 20 : baseMin

    sessions.push({
      day:  ALL_DAYS[dayIdx],
      disc,
      type,
      km:   Math.round(km),
      min:  Math.round(min),
    })
  }

  const sorted = sessions.sort((a, b) =>
    (DAY_INDEX[a.day.toLowerCase()] ?? 0) - (DAY_INDEX[b.day.toLowerCase()] ?? 0),
  )

  console.log('[PLAN] Base week:', sorted.map(s => `${s.day} ${s.disc} ${s.type} ${s.km}km ${s.min}min`))
  console.log('[PLAN] Disciplines in plan:', [...new Set(sorted.map(s => s.disc))])
  console.log('[PLAN] Total km W1:', sorted.reduce((sum, s) => sum + s.km, 0))

  return sorted
}

// ── Week expansion ────────────────────────────────────────────────────────────

function expandPlan(
  baseSessions: AiSession[],
  multipliers: readonly number[],
): Array<{ week: number; sessions: AiSession[] }> {
  return multipliers.map((mult, i) => ({
    week: i + 1,
    sessions: baseSessions.map(s => ({
      ...s,
      km:  Math.max(1, Math.round(s.km  * mult)),
      min: Math.max(10, Math.round(s.min * mult)),
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
        const kmRounded  = Math.round(Number(s.km) || 1)
        const minRounded = Math.round(Number(s.min) || 30)
        const description = buildDescription(disc, typeKey, kmRounded, targetPace)
        const structure   = buildStructure(disc, typeKey, kmRounded, targetPace)
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
          duration_minutes:   minRounded,
          distance_km:        kmRounded,
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

  const goalType    = context.goal?.event_type ?? (context.user.preferences.goal_event_type as string ?? '')
  const targetDate  = context.goal?.target_date as string | undefined
  const preferredStart = context.user.preferences.plan_start_date as string | undefined

  const timing = calculatePlanTiming(targetDate, preferredStart)
  const { multipliers, peakMultiplier } = buildPlanMultipliers(timing.planWeeks, goalType, timing.phase)

  console.log('[PLAN] TIMING:', { planWeeks: timing.planWeeks, phase: timing.phase, startDate: format(timing.startDate, 'yyyy-MM-dd'), weeksUntilRace: timing.weeksUntilRace })
  console.log('[PLAN] MULTIPLIERS:', multipliers)

  const baseSessions = buildBaseWeek(context, peakMultiplier, timing.phase)
  const allWeeks     = expandPlan(baseSessions, multipliers)
  const startDate    = timing.startDate

  console.log('[PLAN] DB insert:', Date.now())

  // Store (or clear) pre-plan message in preferences — avoids needing a schema change
  const updatedPrefs = { ...(context.user.preferences as Record<string, unknown>) }
  if (timing.userMessage) {
    updatedPrefs.pre_plan_message = timing.userMessage
  } else {
    delete updatedPrefs.pre_plan_message
  }
  await supabase.from('users').update({ preferences: updatedPrefs }).eq('id', userId)

  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({
      user_id:     userId,
      start_date:  format(startDate, 'yyyy-MM-dd'),
      end_date:    format(addDays(startDate, timing.planWeeks * 7 - 1), 'yyyy-MM-dd'),
      total_weeks: timing.planWeeks,
      status:      'active',
    })
    .select()
    .single()

  if (planError) throw new Error(`Failed to create training plan: ${planError.message}`)

  const rows = sessionsToRows(plan.id, userId, allWeeks, startDate, context.user.preferences)
  if (rows.length > 0) {
    await supabase.from('sessions').insert(rows)
  }

  console.log('[PLAN] Done:', Date.now())
  console.log(`[PLAN] Inserted ${rows.length} sessions across ${timing.planWeeks} weeks (phase: ${timing.phase})`)
}

export async function generatePlan(userId: string, context: UserContext): Promise<void> {
  return generatePlanSkeleton(userId, context, undefined)
}

export async function startEnrichmentBackground(_userId: string, _context: UserContext): Promise<void> {
  // no-op
}
