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

// ── Race distance constants ───────────────────────────────────────────────────

interface RaceDistances {
  swim?: number
  ride?: number
  run?:  number
}

const RACE_DISTANCES: Record<string, RaceDistances> = {
  ironman:       { swim: 3.8, ride: 180, run: 42 },
  '70.3':        { swim: 1.9, ride: 90,  run: 21 },
  olympic_tri:   { swim: 1.5, ride: 40,  run: 10 },
  sprint_tri:    { swim: 0.75, ride: 20, run: 5  },
  marathon:      { run: 42 },
  half_marathon: { run: 21 },
  '10km':        { run: 10 },
  '5km':         { run: 5  },
  century_ride:  { ride: 160 },
}

function getRaceDistances(goalRaw: string): RaceDistances | null {
  const goalType = detectGoalType(goalRaw)
  return RACE_DISTANCES[goalType] ?? null
}

// Fraction of the long session distance for each session type
const SESSION_TYPE_RATIO: Record<string, number> = {
  long:     1.00,
  easy:     0.65,
  base:     0.65,
  tempo:    0.55,
  interval: 0.45,
  speed:    0.45,
  recovery: 0.50,
  drill:    0.60,
  brick:    0.80,
}

// Fix 6: Fitness-level pace defaults (seconds/km)
const PACE_DEFAULTS_SEC: Record<string, { easy: number; tempo: number; interval: number }> = {
  beginner:     { easy: 450, tempo: 405, interval: 360 },  // 7:30, 6:45, 6:00
  intermediate: { easy: 360, tempo: 315, interval: 285 },  // 6:00, 5:15, 4:45
  advanced:     { easy: 330, tempo: 285, interval: 255 },  // 5:30, 4:45, 4:15
  competitive:  { easy: 300, tempo: 255, interval: 225 },  // 5:00, 4:15, 3:45
}

function kmToMin(disc: string, type: string, km: number, level = 'intermediate'): number {
  let perKm: number
  if (disc === 'run') {
    const def = PACE_DEFAULTS_SEC[level] ?? PACE_DEFAULTS_SEC.intermediate
    perKm = (type === 'interval' || type === 'speed') ? def.interval / 60
           : type === 'tempo' ? def.tempo / 60
           : def.easy / 60
  } else {
    perKm = disc === 'ride' ? 2.2 : 30
  }
  const base = Math.round(km * perKm)
  return Math.max(10, type === 'interval' ? base + 20 : base)
}

// Phase for a given week (mirrors the WeekSection UI formula)
function getWeekPhase(weekNumber: number, totalWeeks: number): 'base' | 'build' | 'peak' | 'taper' | 'race_week' {
  const weeksFromEnd = totalWeeks - weekNumber
  if (weeksFromEnd === 0) return 'race_week'
  if (weeksFromEnd <= 2) return 'taper'
  if (weeksFromEnd <= 4) return 'peak'
  if (weekNumber <= Math.floor(totalWeeks * 0.40)) return 'base'
  return 'build'
}

// Long session km for a given week, working from race distance
// Returns value with 1 decimal precision (important for swim)
function calcWeekLongKm(
  weekNumber: number,
  totalWeeks: number,
  peakLong:   number,
  week1Long:  number,
  raceDistKm?: number,
): number {
  const round1     = (x: number) => Math.round(x * 10) / 10
  const weeksFromEnd = totalWeeks - weekNumber
  const taperStart = Math.max(totalWeeks - 2, 2)

  // Race week: 30% of race distance (short shakeout)
  if (weeksFromEnd === 0) {
    return round1((raceDistKm ?? peakLong) * 0.30)
  }

  // Taper: wk before race = 55% peak, week before that = 70%
  if (weeksFromEnd <= 2) {
    return round1(peakLong * (weeksFromEnd === 1 ? 0.55 : 0.70))
  }

  // Peak weeks (4 and 3 weeks from end): 95% and 100%
  if (weeksFromEnd <= 4) {
    return round1(peakLong * (weeksFromEnd === 3 ? 0.95 : 1.00))
  }

  // Recovery every 4th week: only during base/early build, never in peak or taper
  if (weekNumber % 4 === 0 && weeksFromEnd > 5) {
    const prog = week1Long + ((peakLong - week1Long) / (taperStart - 1)) * (weekNumber - 1)
    return round1(prog * 0.80)
  }

  // Normal build: linear progression week1Long → peakLong
  const progress = taperStart > 1 ? (weekNumber - 1) / (taperStart - 1) : 0
  return round1(week1Long + (peakLong - week1Long) * progress)
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
  const level = (prefs.fitness_level as string) ?? 'intermediate'
  if (disc === 'run') {
    const raw = prefs.run_pace_easy as string | undefined
    if (raw) {
      const sec = parsePaceSec(raw)
      if (type === 'easy' || type === 'long' || type === 'base' || type === 'recovery') return `${raw}/km`
      if (type === 'tempo') return `${formatPace(sec - 45)}/km`
      if (type === 'interval' || type === 'speed') return `${formatPace(sec - 75)}/km`
    } else {
      // Fix 6: Use fitness-level defaults when no pace set
      const def = PACE_DEFAULTS_SEC[level] ?? PACE_DEFAULTS_SEC.intermediate
      if (type === 'easy' || type === 'long' || type === 'base' || type === 'recovery') return `${formatPace(def.easy)}/km`
      if (type === 'tempo') return `${formatPace(def.tempo)}/km`
      if (type === 'interval' || type === 'speed') return `${formatPace(def.interval)}/km`
    }
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
  if (disc === 'ride' && type === 'brick') {
    return `${km}km ride${pace} — keep effort controlled, save legs for the run off the bike`
  }
  if (disc === 'run' && type === 'brick') {
    return `${km}km run immediately off the bike — no break. Legs will feel strange for 2-3 min; that's exactly what race day feels like`
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

type PlanType = 'base_building' | 'race_prep' | 'compressed' | 'standard' | 'extended' | 'long_term'

interface PhaseWeeks {
  baseWeeks:  number
  buildWeeks: number
  peakWeeks:  number
  taperWeeks: number
}

interface PlanTiming {
  planWeeks:      number
  startDate:      Date
  planType:       PlanType
  phaseLabel:     string
  userMessage:    string | null
  weeksUntilRace: number | null
  phases:         PhaseWeeks
}

function nextMonday(d: Date): Date {
  const day = d.getDay()
  if (day === 1) return new Date(d)
  const offset = day === 0 ? 1 : 8 - day
  const m = new Date(d)
  m.setDate(d.getDate() + offset)
  return m
}

function computePhaseWeeks(planWeeks: number, planType: PlanType): PhaseWeeks {
  if (planType === 'base_building') {
    return { baseWeeks: planWeeks, buildWeeks: 0, peakWeeks: 0, taperWeeks: 0 }
  }
  if (planType === 'race_prep' || planType === 'compressed') {
    const taperWeeks = Math.min(1, planWeeks)
    return { baseWeeks: 0, buildWeeks: 0, peakWeeks: planWeeks - taperWeeks, taperWeeks }
  }

  const pcts = planType === 'long_term'
    ? { base: 0.60, build: 0.25, peak: 0.10, taper: 0.05, minTaper: 2 }
    : planType === 'extended'
    ? { base: 0.50, build: 0.30, peak: 0.15, taper: 0.05, minTaper: 2 }
    : { base: 0.40, build: 0.40, peak: 0.15, taper: 0.05, minTaper: 2 }  // standard — min 2 taper weeks

  const taperWeeks = Math.max(pcts.minTaper, Math.round(planWeeks * pcts.taper))
  const afterTaper = planWeeks - taperWeeks
  const peakWeeks  = Math.max(1, Math.round(afterTaper * (pcts.peak / (1 - pcts.taper))))
  const afterPeak  = afterTaper - peakWeeks
  const buildWeeks = Math.round(afterPeak * (pcts.build / (pcts.base + pcts.build)))
  const baseWeeks  = afterPeak - buildWeeks

  return { baseWeeks, buildWeeks, peakWeeks, taperWeeks }
}

function calculatePlanTiming(
  targetDate:         string | undefined | null,
  preferredStartDate: string | undefined | null,
  trainingPhase?:     string | null,
): PlanTiming {
  const today     = new Date()
  const msPerWeek = 7 * 24 * 60 * 60 * 1000

  const startDate = preferredStartDate
    ? nextMonday(new Date(preferredStartDate + 'T12:00:00'))
    : nextMonday(today)

  // No race date, or phase isn't race-focused → 12-week base building plan
  const isRacePhase = trainingPhase === 'race'
  if (!targetDate || !isRacePhase) {
    const phases = computePhaseWeeks(12, 'base_building')
    return {
      planWeeks: 12, startDate, planType: 'base_building', phaseLabel: 'Base Building Plan',
      userMessage: null, weeksUntilRace: null, phases,
    }
  }

  const raceDate       = new Date(targetDate + 'T12:00:00')
  const totalWeeks     = Math.ceil((raceDate.getTime() - startDate.getTime()) / msPerWeek)
  const weeksFromToday = Math.floor((raceDate.getTime() - today.getTime()) / msPerWeek)
  const raceDateStr    = format(raceDate, 'd MMMM yyyy')
  const startDateStr   = format(startDate, 'd MMMM')

  // Race already passed
  if (totalWeeks <= 0) {
    const phases = computePhaseWeeks(1, 'race_prep')
    return {
      planWeeks: 1, startDate, planType: 'race_prep', phaseLabel: 'Race Week',
      userMessage: 'Race day is here — rest, stay sharp, and focus on race-day logistics.',
      weeksUntilRace: weeksFromToday, phases,
    }
  }

  // Classify plan type by total duration
  const planType: PlanType =
    totalWeeks <= 7  ? 'race_prep'
    : totalWeeks <= 11 ? 'compressed'
    : totalWeeks <= 16 ? 'standard'
    : totalWeeks <= 24 ? 'extended'
    : 'long_term'

  const phases = computePhaseWeeks(totalWeeks, planType)

  let phaseLabel: string
  let userMessage: string

  if (planType === 'race_prep') {
    phaseLabel   = 'Race Prep Plan'
    userMessage  = `${totalWeeks} week${totalWeeks !== 1 ? 's' : ''} to race day on ${raceDateStr} — ${totalWeeks <= 3 ? 'keeping you sharp and arriving fresh' : 'race-specific work with a taper in the final week'}.`
  } else if (planType === 'compressed') {
    phaseLabel   = 'Race Ready Plan'
    userMessage  = `${totalWeeks} weeks to race day on ${raceDateStr}. Starting ${startDateStr}, building intensity week by week through to your race.`
  } else {
    phaseLabel = `${totalWeeks}-Week Race Plan`
    if (phases.baseWeeks > 0) {
      const baseEndDate  = format(addDays(startDate, phases.baseWeeks * 7 - 1), 'd MMM')
      const buildStart   = format(addDays(startDate, phases.baseWeeks * 7), 'd MMMM')
      userMessage = `Your race is ${totalWeeks} weeks away on ${raceDateStr}. Starting ${startDateStr}, we build your aerobic base through ${baseEndDate}, then shift to race-specific work from ${buildStart}.`
    } else {
      userMessage = `Your race is ${totalWeeks} weeks away on ${raceDateStr}. ${totalWeeks}-week plan starting ${startDateStr}.`
    }
  }

  return {
    planWeeks: totalWeeks, startDate, planType, phaseLabel,
    userMessage, weeksUntilRace: weeksFromToday, phases,
  }
}

// ── Volume multipliers scaled to plan length ──────────────────────────────────

function buildPlanMultipliers(
  planWeeks: number,
  planType:  PlanType,
  goalType:  string,
  phases:    PhaseWeeks,
): { multipliers: number[]; peakMultiplier: number } {
  const peakMult = peakMultiplierForGoal(goalType)

  if (planWeeks <= 1) return { multipliers: [0.55], peakMultiplier: peakMult }

  // Race prep: hold close to current fitness, taper last week
  if (planType === 'race_prep') {
    const mults: number[] = []
    const holdN = planWeeks - 1
    for (let i = 0; i < holdN; i++) {
      const frac = holdN > 1 ? i / (holdN - 1) : 0
      mults.push(parseFloat((0.90 + frac * 0.10).toFixed(2)))
    }
    mults.push(0.65)
    return { multipliers: mults, peakMultiplier: peakMult }
  }

  // Compressed: build from 1.10 to peak, 1 taper week
  if (planType === 'compressed') {
    const mults: number[] = []
    const buildN = planWeeks - 1
    for (let i = 0; i < buildN; i++) {
      const isRecovery = buildN >= 4 && (i + 1) % 4 === 0
      if (isRecovery) {
        mults.push(0.85)
      } else {
        const frac = buildN > 1 ? i / (buildN - 1) : 0
        mults.push(parseFloat((1.10 + frac * (peakMult - 1.10)).toFixed(2)))
      }
    }
    mults.push(0.65)
    return { multipliers: mults, peakMultiplier: peakMult }
  }

  // Base building: 1.00 → 1.15 over planWeeks, recovery every 4th week, no taper
  if (planType === 'base_building') {
    const mults: number[] = []
    for (let i = 0; i < planWeeks; i++) {
      const isRecovery = (i + 1) % 4 === 0
      if (isRecovery) {
        mults.push(0.85)
      } else {
        const frac = planWeeks > 1 ? i / (planWeeks - 1) : 0
        mults.push(parseFloat((1.00 + frac * 0.15).toFixed(2)))
      }
    }
    return { multipliers: mults, peakMultiplier: peakMult }
  }

  // Standard / Extended / Long-term: always work backwards from race day.
  // Fixed tail (week_from_end 0→4): race week, taper1, taper2, peak1, peak2
  const mults: number[] = []
  const tail    = [0.50, 0.65, 0.75, 1.35, 1.30]
  const tailLen = Math.min(tail.length, planWeeks)
  const buildLen = planWeeks - tailLen

  // Build/base phase: progressive 1.00 → 1.20, recovery every 4th week
  for (let i = 0; i < buildLen; i++) {
    const isRecovery = (i + 1) % 4 === 0
    if (isRecovery) {
      mults.push(0.85)
    } else {
      const frac = buildLen > 1 ? i / (buildLen - 1) : 0
      mults.push(parseFloat((1.00 + frac * 0.20).toFixed(2)))
    }
  }

  // Tail: add in reverse so race week (tail[0]=0.50) is the very last multiplier
  for (let i = tailLen - 1; i >= 0; i--) {
    mults.push(tail[i])
  }

  return { multipliers: mults, peakMultiplier: peakMult }
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

// Find allowed day closest FORWARD from anchor
function findAdjacentDay(anchor: number, allowed: number[]): number {
  const others = (allowed.length > 0 ? allowed : [0,1,2,3,4,5,6]).filter(d => d !== anchor)
  if (!others.length) return (anchor + 1) % 7
  return others.reduce((best, d) => {
    const fwdD    = (d    - anchor + 7) % 7
    const fwdBest = (best - anchor + 7) % 7
    return fwdD < fwdBest ? d : best
  }, others[0])
}

// Fix 5: Find day at least minGap days away from anchor (circular), maximises separation
function findSeparatedDay(anchor: number, pool: number[], minGap = 2): number {
  const others = (pool.length > 0 ? pool : [0,1,2,3,4,5,6]).filter(d => d !== anchor)
  if (!others.length) return (anchor + 1) % 7
  const candidates = others.filter(d => {
    const fwd = (d - anchor + 7) % 7
    const bwd = (anchor - d + 7) % 7
    return Math.min(fwd, bwd) >= minGap
  })
  const search = candidates.length > 0 ? candidates : others
  return search.reduce((best, d) => {
    const dD = Math.min((d - anchor + 7) % 7, (anchor - d + 7) % 7)
    const dB = Math.min((best - anchor + 7) % 7, (anchor - best + 7) % 7)
    return dD > dB ? d : best
  }, search[0])
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
  longRideDayOverride?: number,
): Array<{ dayIdx: number; slot: Slot }> {

  // Pool: the days we are allowed to use
  const pool = allowedDays.length > 0 ? allowedDays : [0,1,2,3,4,5,6]

  // Long RUN on preferred day; long RIDE from coach notes or at least 2 days away (fix 5)
  const longRunDay  = nearestAllowedDay(longDayIdx, pool)
  const longRideDay = longRideDayOverride !== undefined
    ? nearestAllowedDay(longRideDayOverride, pool)
    : findSeparatedDay(longRunDay, pool, 2)

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

  // Dedup: same discipline on same day — move to an available pool day or drop
  const seenKey = new Map<string, true>()
  const deduped: typeof entries = []
  for (const e of entries) {
    const key = `${e.dayIdx}-${e.disc}`
    if (!seenKey.has(key)) {
      seenKey.set(key, true)
      deduped.push(e)
    } else {
      const usedByDisc = new Set(deduped.filter(x => x.disc === e.disc).map(x => x.dayIdx))
      const alt = pool.find(d => !usedByDisc.has(d) && !seenKey.has(`${d}-${e.disc}`))
      if (alt !== undefined) {
        seenKey.set(`${alt}-${e.disc}`, true)
        deduped.push({ ...e, dayIdx: alt })
      }
    }
  }

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

// ── Notes-driven template: places exact per-discipline session counts ──────────

function buildNotesDrivenTemplate(
  runCount:   number,
  rideCount:  number,
  swimCount:  number,
  longDayIdx: number,
  pool:       number[],
  hasQuality: boolean,
  longRideDayOverride?: number,
): Array<{ dayIdx: number; slot: Slot }> {
  const longRunDay  = nearestAllowedDay(longDayIdx, pool)
  const longRideDay = longRideDayOverride !== undefined
    ? nearestAllowedDay(longRideDayOverride, pool)
    : findSeparatedDay(longRunDay, pool, 2)

  type ToPlace = { disc: 'run' | 'ride' | 'swim'; type: string; preferDay?: number }
  const toPlace: ToPlace[] = []

  if (runCount > 0) {
    toPlace.push({ disc: 'run', type: 'long', preferDay: longRunDay })
    for (let i = 1; i < runCount; i++) {
      toPlace.push({ disc: 'run', type: hasQuality && i === runCount - 1 ? 'tempo' : 'easy' })
    }
  }
  if (rideCount > 0) {
    toPlace.push({ disc: 'ride', type: 'long', preferDay: longRideDay })
    for (let i = 1; i < rideCount; i++) {
      toPlace.push({ disc: 'ride', type: hasQuality && i === rideCount - 1 ? 'tempo' : 'easy' })
    }
  }
  for (let i = 0; i < swimCount; i++) {
    toPlace.push({ disc: 'swim', type: i === swimCount - 1 ? 'interval' : 'base' })
  }

  // Track what's scheduled per day (no two of same disc; max 2 per day)
  const dayMap: Map<number, ('run' | 'ride' | 'swim')[]> = new Map()
  for (const d of pool) dayMap.set(d, [])

  const placed: Array<{ dayIdx: number; disc: 'run' | 'ride' | 'swim'; type: string }> = []

  for (const s of toPlace) {
    let target: number | undefined

    // Try preferred day (for anchor sessions)
    if (s.preferDay !== undefined) {
      const on = dayMap.get(s.preferDay) ?? []
      if (!on.includes(s.disc) && on.length < 2) target = s.preferDay
    }

    // Find best available day: fewest sessions, no same disc, max 2 total
    if (target === undefined) {
      let bestCount = 999
      for (const [d, on] of dayMap) {
        if (on.includes(s.disc) || on.length >= 2) continue
        if (on.length < bestCount) { bestCount = on.length; target = d }
      }
    }

    if (target === undefined) continue  // can't place — pool is full, skip
    dayMap.get(target)!.push(s.disc)
    placed.push({ dayIdx: target, disc: s.disc, type: s.type })
  }

  const runPlaced  = placed.filter(e => e.disc === 'run')
  const ridePlaced = placed.filter(e => e.disc === 'ride')
  const swimPlaced = placed.filter(e => e.disc === 'swim')

  function shares(entries: typeof placed): number[] {
    if (!entries.length) return []
    const w = entries.map(e => e.type === 'long' ? 2.0 : e.type === 'tempo' ? 0.9 : e.type === 'interval' ? 0.7 : 1.0)
    const t = w.reduce((s, x) => s + x, 0)
    return w.map(x => x / t)
  }

  const rs = shares(runPlaced), rids = shares(ridePlaced), ss = shares(swimPlaced)

  return [
    ...runPlaced.map((e, i)  => ({ dayIdx: e.dayIdx, slot: { disc: e.disc, type: e.type, kmShare: rs[i],   minPerKm: 6.5 } as Slot })),
    ...ridePlaced.map((e, i) => ({ dayIdx: e.dayIdx, slot: { disc: e.disc, type: e.type, kmShare: rids[i], minPerKm: 2.2 } as Slot })),
    ...swimPlaced.map((e, i) => ({ dayIdx: e.dayIdx, slot: { disc: e.disc, type: e.type, kmShare: ss[i],   minPerKm: 30  } as Slot })),
  ]
}

// ── Coach notes constraint parser ─────────────────────────────────────────────

interface CoachNoteConstraints {
  weekdayMaxMin?:       number
  longRunDayOverride?:  number
  longRideDayOverride?: number
  avoidHighImpactRun?:  boolean
  totalSessions?:       number
  runSessions?:         number
  rideSessions?:        number
  swimSessions?:        number
}

function parseCoachNotes(notes: string): CoachNoteConstraints {
  console.log('[NOTES] RAW NOTES INPUT:', notes)
  if (!notes?.trim()) return {}
  const lower = notes.toLowerCase()
  const result: CoachNoteConstraints = {}

  // Duration cap: "under 60 mins", "max 60 min", "no more than 60 minutes"
  const timeMatch = lower.match(/(?:under|less than|max(?:imum)?\s*of?|no more than)\s+(\d+)\s*min/)
  if (timeMatch) result.weekdayMaxMin = parseInt(timeMatch[1])
  else if (/(?:max|under|less than)\s+1\s+hour/.test(lower)) result.weekdayMaxMin = 60

  // Long run day override: "long run on Sunday"
  const longRunMatch = lower.match(/long\s+runs?\s+on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)s?/)
  if (longRunMatch) {
    const key = longRunMatch[1].replace(/s$/, '')
    if (DAY_INDEX[key] !== undefined) result.longRunDayOverride = DAY_INDEX[key]
  }

  // Long ride day override: "long ride/bike/cycle on Sunday"
  const longRideMatch = lower.match(/long\s+(?:rides?|bikes?|cycles?)\s+on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)s?/)
  if (longRideMatch) {
    const key = longRideMatch[1].replace(/s$/, '')
    if (DAY_INDEX[key] !== undefined) result.longRideDayOverride = DAY_INDEX[key]
  }

  // Injury flags
  if (/knee|ankle|shin|calf|plantar|achilles/.test(lower)) result.avoidHighImpactRun = true

  // Number word → integer helper
  const W: Record<string, number> = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, once:1, twice:2 }
  function toN(s: string): number | undefined { return /^\d+$/.test(s) ? parseInt(s) : W[s] }
  const numPat = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|once|twice)'

  // Total sessions: "9 workouts a week", "train 9 times"
  const totalM = lower.match(new RegExp(`${numPat}\\s+(?:workouts?|sessions?|times?)\\s+(?:a|per)\\s+week`))
    ?? lower.match(new RegExp(`train\\s+${numPat}\\s+times?(?:\\s+(?:a|per)\\s+week)?`))
  if (totalM) { const n = toN(totalM[1]); if (n) result.totalSessions = n }

  // Per-discipline counts: "3 runs", "run 3 times", "3 runs a week"
  function discCount(sing: string, plurals: string[]): number | undefined {
    const pp = plurals.join('|')
    // "3 runs [a week]"
    const m1 = lower.match(new RegExp(`${numPat}\\s+(?:${pp})(?:\\s+(?:a|per)\\s+week)?`))
    if (m1) { const n = toN(m1[1]); if (n !== undefined) return n }
    // "run 3 times" / "run 3x" / "run 3 per week"
    const m2 = lower.match(new RegExp(`${sing}\\s+${numPat}(?:\\s*x|\\s+times?|\\s+(?:a|per)\\s+week)`))
    if (m2) { const n = toN(m2[1]); if (n !== undefined) return n }
    return undefined
  }

  const runN  = discCount('run',  ['runs'])
  const rideN = discCount('ride', ['rides', 'bikes', 'cycles'])
  const swimN = discCount('swim', ['swims'])
  if (runN  !== undefined) result.runSessions  = runN
  if (rideN !== undefined) result.rideSessions = rideN
  if (swimN !== undefined) result.swimSessions = swimN

  console.log('[NOTES] PARSED RESULT:', JSON.stringify(result))
  return result
}

// ── Base week construction ────────────────────────────────────────────────────

function buildBaseWeek(ctx: UserContext, peakMultiplier: number, planType: PlanType): AiSession[] {
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
  let longDayIdx    = allowedDays.length > 0 ? nearestAllowedDay(rawLongIdx, allowedDays) : rawLongIdx

  // Coach notes take priority: override long run/ride day if athlete specified one
  const noteConstraints = parseCoachNotes(ctx.user.coach_notes_freetext ?? '')
  if (noteConstraints.longRunDayOverride !== undefined) {
    const override = noteConstraints.longRunDayOverride
    if (allowedDays.length === 0 || allowedDays.includes(override)) {
      longDayIdx = override
      console.log('[PLAN] NOTES: long run day overridden to', ALL_DAYS[override])
    }
  }
  const longRideDayOverride = noteConstraints.longRideDayOverride !== undefined
    && (allowedDays.length === 0 || allowedDays.includes(noteConstraints.longRideDayOverride))
    ? noteConstraints.longRideDayOverride
    : undefined
  if (longRideDayOverride !== undefined) {
    console.log('[PLAN] NOTES: long ride day overridden to', ALL_DAYS[longRideDayOverride])
  }

  const isReturn    = training_phase === 'return'
  const goalType    = ctx.goal?.event_type ?? (preferences.goal_event_type as string ?? '')
  const caps        = getCapsForGoal(level, goalType)
  const startPct    = isReturn ? 0.60 : 0.90

  // No quality sessions during race prep or base building (easy aerobic work only)
  const hasQuality = level !== 'beginner' && !isReturn
    && planType !== 'race_prep' && planType !== 'base_building'

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
  const hasRun  = allowedDiscs.has('run')
  const hasRide = allowedDiscs.has('ride')
  const hasSwim = allowedDiscs.has('swim')
  const pool    = allowedDays.length > 0 ? allowedDays : [0,1,2,3,4,5,6]

  const hasNoteCounts = noteConstraints.runSessions  !== undefined
    || noteConstraints.rideSessions !== undefined
    || noteConstraints.swimSessions !== undefined

  let template: ReturnType<typeof buildWeekTemplate>
  if (hasNoteCounts || noteConstraints.totalSessions !== undefined) {
    const totalDiscs = Math.max(1, allowedDiscs.size)
    const defaultPer = Math.max(1, Math.round((noteConstraints.totalSessions ?? daysPerWeek) / totalDiscs))
    const runCount  = hasRun  ? (noteConstraints.runSessions  ?? defaultPer) : 0
    const rideCount = hasRide ? (noteConstraints.rideSessions ?? defaultPer) : 0
    const swimCount = hasSwim ? (noteConstraints.swimSessions ?? defaultPer) : 0
    console.log('[PLAN] NOTES: per-disc counts → run:', runCount, 'ride:', rideCount, 'swim:', swimCount)
    template = buildNotesDrivenTemplate(runCount, rideCount, swimCount, longDayIdx, pool, hasQuality, longRideDayOverride)
  } else {
    template = buildWeekTemplate(daysPerWeek, discSet, longDayIdx, level, hasQuality, allowedDays, longRideDayOverride)
  }
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

  // Apply coach note hard constraints before sorting
  if (noteConstraints.weekdayMaxMin) {
    for (const s of sessions) {
      const di = DAY_INDEX[s.day.toLowerCase()] ?? 0
      if (di <= 4 && s.min > noteConstraints.weekdayMaxMin) {
        const ratio = noteConstraints.weekdayMaxMin / s.min
        s.min = noteConstraints.weekdayMaxMin
        s.km  = Math.max(1, Math.round(s.km * ratio))
      }
    }
    console.log('[PLAN] NOTES: weekday sessions capped to', noteConstraints.weekdayMaxMin, 'min')
  }
  if (noteConstraints.avoidHighImpactRun) {
    for (const s of sessions) {
      if (s.disc === 'run' && (s.type === 'interval' || s.type === 'tempo')) s.type = 'easy'
    }
    console.log('[PLAN] NOTES: high-impact run sessions → easy (injury avoidance)')
  }

  const sorted = sessions.sort((a, b) =>
    (DAY_INDEX[a.day.toLowerCase()] ?? 0) - (DAY_INDEX[b.day.toLowerCase()] ?? 0),
  )

  // Fix 9: Hard/easy alternation — no two consecutive leg-heavy hard sessions
  const legHardTypes = new Set(['tempo', 'interval', 'speed', 'long'])
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (!['run', 'ride'].includes(a.disc) || !['run', 'ride'].includes(b.disc)) continue
    const aDow = DAY_INDEX[a.day.toLowerCase()] ?? 0
    const bDow = DAY_INDEX[b.day.toLowerCase()] ?? 0
    if (Math.abs(aDow - bDow) === 1 && legHardTypes.has(a.type) && legHardTypes.has(b.type)) {
      sorted[i + 1] = { ...sorted[i + 1], type: 'easy' }
    }
  }

  // Hard constraint: remove any sessions that landed outside allowed days
  const result = allowedDays.length > 0
    ? sorted.filter(s => allowedDays.includes(DAY_INDEX[s.day.toLowerCase()] ?? -1))
    : sorted
  if (result.length < sorted.length) {
    console.log('[PLAN] HARD_CONSTRAINT: removed', sorted.length - result.length, 'sessions on non-allowed days')
  }

  console.log('[PLAN] Base week:', result.map(s => `${s.day} ${s.disc} ${s.type} ${s.km}km ${s.min}min`))
  console.log('[PLAN] Disciplines in plan:', [...new Set(result.map(s => s.disc))])
  console.log('[PLAN] Total km W1:', result.reduce((sum, s) => sum + s.km, 0))

  return result
}

// ── Week expansion ────────────────────────────────────────────────────────────

function expandPlan(
  baseSessions:    AiSession[],
  multipliers:     readonly number[],
  raceDistances:   RaceDistances | null,
  currentWeeklyKm: Record<string, number>,
  totalWeeks:      number,
  level:           string = 'intermediate',
): Array<{ week: number; sessions: AiSession[] }> {

  const round1 = (x: number) => Math.round(x * 10) / 10

  // Compute peak long and week-1 long per discipline from race distance
  const peakLong:  Record<string, number> = {}
  const week1Long: Record<string, number> = {}

  if (raceDistances) {
    for (const disc of ['run', 'ride', 'swim'] as const) {
      const raceDist = raceDistances[disc]
      if (!raceDist) continue
      const currentLong = round1((currentWeeklyKm[disc] ?? 0) * 0.40)
      // Fix 7: Swim peaks at 110% race distance (open-water confidence buffer)
      const targetPeak  = disc === 'swim'
        ? round1(raceDist * 1.10)
        : round1(raceDist * 0.90)
      peakLong[disc]  = Math.max(currentLong, targetPeak)
      week1Long[disc] = round1(Math.max(currentLong, peakLong[disc] * 0.45))
    }
  }

  console.log('[PLAN] LONG-SESSION PEAKS (race-dist formula):', peakLong)
  console.log('[PLAN] LONG-SESSION WEEK-1:                  ', week1Long)

  const discsWithFormula = new Set(Object.keys(peakLong))

  // Fix 8: Brick scheduling setup for triathlon athletes
  const isTri = (raceDistances?.ride != null) && (raceDistances?.run != null)
  const longRunDow  = (() => {
    const s = baseSessions.find(s => s.disc === 'run'  && s.type === 'long')
    return s ? (DAY_INDEX[s.day.toLowerCase()] ?? -1) : -1
  })()
  const longRideDow = (() => {
    const s = baseSessions.find(s => s.disc === 'ride' && s.type === 'long')
    return s ? (DAY_INDEX[s.day.toLowerCase()] ?? -1) : -1
  })()
  // Brick day: prefer Wed or Thu, avoiding long-session days and days with existing run/ride
  const brickDow = isTri
    ? ([2, 3, 1, 4, 0].find(d => {
        if (d === longRunDow || d === longRideDow) return false
        return !baseSessions.some(s => DAY_INDEX[s.day.toLowerCase()] === d && (s.disc === 'run' || s.disc === 'ride'))
      }) ?? -1)
    : -1

  // Interval distance caps (fix 3)
  const INTERVAL_CAPS: Record<string, number> = { run: 12, ride: 60, swim: 3.5 }

  return multipliers.map((mult, i) => {
    const weekNumber    = i + 1
    const phase         = getWeekPhase(weekNumber, totalWeeks)
    const buildStart    = Math.floor(totalWeeks * 0.40)
    const weeksIntoBuild = weekNumber - buildStart

    // Quality counter per discipline — resets each week
    const qualCount: Record<string, number> = {}

    const sessions = baseSessions.map(s => {
      const disc = s.disc

      // No race distance for this discipline → fall back to multiplier
      if (!discsWithFormula.has(disc)) {
        return {
          ...s,
          km:  Math.max(1,  Math.round(s.km  * mult)),
          min: Math.max(10, Math.round(s.min * mult)),
        }
      }

      const weekLong = calcWeekLongKm(
        weekNumber, totalWeeks, peakLong[disc], week1Long[disc],
        raceDistances?.[disc as 'swim' | 'ride' | 'run'],
      )

      // Fix 2: Strict phase gating
      let sessionType = s.type

      if (phase === 'base') {
        // Base: ONLY easy, long, base, recovery — zero quality
        if (sessionType === 'tempo' || sessionType === 'interval' || sessionType === 'speed') {
          sessionType = 'easy'
        }
      } else if (phase === 'build') {
        if (weeksIntoBuild < 3) {
          // Early build: tempo only, no intervals
          if (sessionType === 'interval' || sessionType === 'speed') {
            sessionType = 'tempo'
          }
        } else {
          // Late build: max 1 interval per discipline per week
          if (sessionType === 'interval' || sessionType === 'speed') {
            if ((qualCount[disc] ?? 0) >= 1) {
              sessionType = 'tempo'
            } else {
              qualCount[disc] = (qualCount[disc] ?? 0) + 1
            }
          }
        }
      } else if (phase === 'peak') {
        // Peak: all types allowed, max 2 quality per discipline
        if (sessionType === 'tempo' || sessionType === 'interval' || sessionType === 'speed') {
          if ((qualCount[disc] ?? 0) >= 2) {
            sessionType = 'easy'
          } else {
            qualCount[disc] = (qualCount[disc] ?? 0) + 1
          }
        }
      } else if (phase === 'taper') {
        // Taper: max 1 quality per discipline
        if (sessionType === 'tempo' || sessionType === 'interval' || sessionType === 'speed') {
          if ((qualCount[disc] ?? 0) >= 1) {
            sessionType = 'easy'
          } else {
            qualCount[disc] = (qualCount[disc] ?? 0) + 1
          }
        }
      }
      // race_week: no quality (all easy) — handled by processRaceWeek replacing everything

      const ratio  = SESSION_TYPE_RATIO[sessionType] ?? 0.65
      const rawKm  = sessionType === 'long' ? weekLong : weekLong * ratio
      let km = disc === 'swim'
        ? Math.max(0.5, round1(rawKm))
        : Math.max(1,   Math.round(rawKm))

      // Fix 3: Hard cap on interval distances
      if ((sessionType === 'interval' || sessionType === 'speed') && INTERVAL_CAPS[disc] !== undefined) {
        km = disc === 'swim'
          ? Math.min(km, INTERVAL_CAPS[disc])
          : Math.min(km, INTERVAL_CAPS[disc])
      }

      const min = kmToMin(disc, sessionType, km, level)
      return { ...s, type: sessionType, km, min }
    })

    // Fix 8: Inject brick sessions for triathlon athletes in build/peak/taper
    const brickSessions: AiSession[] = []
    if (isTri && brickDow >= 0 && raceDistances?.ride && raceDistances?.run
        && (phase === 'build' || phase === 'peak' || phase === 'taper')) {
      let rideKm = 0, runKm = 0

      if (phase === 'build') {
        if (weeksIntoBuild < 3) {
          rideKm = Math.round(raceDistances.ride * 0.35)
          runKm  = Math.round(raceDistances.run  * 0.25)
        } else {
          rideKm = Math.round(raceDistances.ride * 0.55)
          runKm  = Math.round(raceDistances.run  * 0.40)
        }
      } else if (phase === 'peak') {
        rideKm = Math.round(raceDistances.ride * 0.70)
        runKm  = Math.round(raceDistances.run  * 0.55)
      } else if (phase === 'taper') {
        rideKm = Math.round(raceDistances.ride * 0.35)
        runKm  = Math.round(raceDistances.run  * 0.20)
      }

      if (rideKm > 0 && runKm > 0) {
        const brickDay = ALL_DAYS[brickDow]
        brickSessions.push({
          day: brickDay, disc: 'ride', type: 'brick',
          km: rideKm, min: Math.round(rideKm * 2.2),
        })
        brickSessions.push({
          day: brickDay, disc: 'run', type: 'brick',
          km: runKm, min: kmToMin('run', 'easy', runKm, level),
        })
      }
    }

    return { week: weekNumber, sessions: [...sessions, ...brickSessions] }
  })
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
        const kmRounded  = disc === 'swim'
          ? Math.max(0.5, Math.round((Number(s.km) || 0.5) * 10) / 10)
          : Math.max(1, Math.round(Number(s.km) || 1))
        const minRounded = Math.round(Number(s.min) || 30)
        const description = buildDescription(disc, typeKey, kmRounded, targetPace)
        const structure   = buildStructure(disc, typeKey, kmRounded, targetPace)
        const isBrickRide = typeKey === 'brick' && disc === 'ride'
        const isBrickRun  = typeKey === 'brick' && disc === 'run'
        const rationale   = isBrickRide
          ? 'Complete immediately before the brick run. No rest between disciplines — rack your bike and head straight out on the run. Builds the bike-to-run transition that defines triathlon racing.'
          : isBrickRun
          ? 'Start immediately after the brick ride. This simulates race day T2 transition. Your legs will feel strange for the first 2–3 minutes — that is normal and improves with practice.'
          : (RATIONALE[disc]?.[typeKey] ?? `${label} session — builds specific fitness for your goal.`)
        const titleStr = isBrickRide ? 'Brick Ride 🧱'
          : isBrickRun  ? 'Brick Run 🧱'
          : `${label} ${discCap}`
        return {
          plan_id:            planId,
          user_id:            userId,
          week_number:        week,
          day_of_week:        dow,
          scheduled_date:     format(addDays(startDate, (week - 1) * 7 + dow), 'yyyy-MM-dd'),
          discipline:         disc,
          session_type:       typeKey,
          title:              titleStr,
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

// ── Race week post-processing (Fix 1) ─────────────────────────────────────────
//
// Replace entire final week with hardcoded, genuinely easy sessions.
// Max 3 sessions before race day, all Zone 1, no bricks.

function processRaceWeek(
  rows:        ReturnType<typeof sessionsToRows>,
  finalWeek:   number,
  raceDayDow:  number,     // 0=Mon … 6=Sun
  planId:      string,
  userId:      string,
  raceDate:    Date,
  eventType:   string,
  disciplines: string[],
): ReturnType<typeof sessionsToRows> {
  const nonFinal = rows.filter(r => r.week_number !== finalWeek)

  const hasSwim = disciplines.includes('swim')
  const hasRide = disciplines.includes('ride')
  const hasRun  = disciplines.includes('run')

  function makeRow(
    dow: number,
    disc: string,
    stype: string,
    title: string,
    desc: string,
    km: number,
    min: number,
  ) {
    return {
      plan_id:            planId,
      user_id:            userId,
      week_number:        finalWeek,
      day_of_week:        dow,
      scheduled_date:     format(addDays(raceDate, dow - raceDayDow), 'yyyy-MM-dd'),
      discipline:         disc,
      session_type:       stype,
      title,
      description:        desc,
      session_structure:  [{ description: desc }],
      coaching_rationale: 'Race week: movement without fatigue. Zone 1 only — protect your legs for race day.',
      effort_zone:        'Zone 1',
      target_pace:        null,
      duration_minutes:   min,
      distance_km:        km,
      status:             'planned' as const,
    }
  }

  // Hardcoded race-week sessions based on race day
  // raceDayDow 6 = Sunday, 5 = Saturday
  const preRaceRows: ReturnType<typeof makeRow>[] = []

  if (raceDayDow === 6) {
    // Sunday race
    // Mon: easy swim 800m or easy run 20min
    if (hasSwim) {
      preRaceRows.push(makeRow(0, 'swim', 'easy', 'Easy Swim', '800m easy swim — long slow strokes, focus on feel', 0.8, 25))
    } else if (hasRun) {
      preRaceRows.push(makeRow(0, 'run', 'easy', 'Easy Run', '3km easy jog — conversational pace, just shake out the legs', 3, 20))
    }
    // Tue: easy ride 20km
    if (hasRide) {
      preRaceRows.push(makeRow(1, 'ride', 'easy', 'Easy Ride', '20km easy spin — keep it Zone 1, just keep the legs moving', 20, 45))
    }
    // Wed: easy run 3km + strides
    if (hasRun) {
      preRaceRows.push(makeRow(2, 'run', 'easy', 'Easy Run + Strides', '3km easy run with 4×20s strides at race pace — keep legs feeling sharp', 3, 20))
    }
    // Thu, Fri, Sat: rest (no rows = rest days)
  } else if (raceDayDow === 5) {
    // Saturday race
    // Mon: easy swim 800m
    if (hasSwim) {
      preRaceRows.push(makeRow(0, 'swim', 'easy', 'Easy Swim', '800m easy swim — relax, focus on stroke efficiency', 0.8, 25))
    } else if (hasRun) {
      preRaceRows.push(makeRow(0, 'run', 'easy', 'Easy Run', '3km easy jog — shake out the legs, nothing more', 3, 20))
    }
    // Tue: easy ride 20km
    if (hasRide) {
      preRaceRows.push(makeRow(1, 'ride', 'easy', 'Easy Ride', '20km easy spin — Zone 1 only, keep it relaxed', 20, 45))
    }
    // Wed: easy run 3km + strides
    if (hasRun) {
      preRaceRows.push(makeRow(2, 'run', 'easy', 'Easy Run + Strides', '3km easy with 4×20s race-pace strides — stay sharp', 3, 20))
    }
    // Thu, Fri: rest
  } else {
    // Midweek race — just 1-2 easy sessions Mon-Tue before race
    if (hasRun && raceDayDow > 1) {
      preRaceRows.push(makeRow(0, 'run', 'easy', 'Easy Run', '20min easy jog — loosen the legs, nothing stressful', 3, 20))
    }
    if (hasRide && raceDayDow > 2) {
      preRaceRows.push(makeRow(1, 'ride', 'easy', 'Easy Ride', '20km easy spin — keep it Zone 1', 20, 45))
    }
  }

  const raceDayRow = {
    plan_id:            planId,
    user_id:            userId,
    week_number:        finalWeek,
    day_of_week:        raceDayDow,
    scheduled_date:     format(raceDate, 'yyyy-MM-dd'),
    discipline:         'rest' as const,
    session_type:       'race',
    title:              'RACE DAY 🏁',
    description:        `${eventType || 'Race day'} — all your training has led to this.`,
    session_structure:  [{ description: 'Race day. Trust your preparation and execute your plan.' }],
    coaching_rationale: "You've done the work. Arrive rested, stay warm, race your plan. Enjoy every kilometre.",
    effort_zone:        'Race effort',
    target_pace:        null,
    duration_minutes:   0,
    distance_km:        0,
    status:             'planned' as const,
  }

  return [...nonFinal, ...preRaceRows, raceDayRow]
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

  const timing = calculatePlanTiming(targetDate, preferredStart, context.user.training_phase as string)
  const { multipliers, peakMultiplier } = buildPlanMultipliers(timing.planWeeks, timing.planType, goalType, timing.phases)

  const currentWeeklyKm = {
    run:  Number(context.user.preferences.run_weekly_km)  || 0,
    ride: Number(context.user.preferences.ride_weekly_km) || 0,
    swim: Number(context.user.preferences.swim_weekly_km) || 0,
  }
  const raceDistances = timing.planType !== 'base_building' ? getRaceDistances(goalType) : null

  console.log('[PLAN] TIMING:', { planWeeks: timing.planWeeks, planType: timing.planType, startDate: format(timing.startDate, 'yyyy-MM-dd'), phases: timing.phases, weeksUntilRace: timing.weeksUntilRace })
  console.log('[PLAN] MULTIPLIERS:', multipliers)
  console.log('[PLAN] RACE DISTANCES:', raceDistances)
  console.log('[PLAN] CURRENT WEEKLY KM:', currentWeeklyKm)

  const level = (context.user.preferences.fitness_level as string) ?? 'intermediate'
  const baseSessions = buildBaseWeek(context, peakMultiplier, timing.planType)
  const allWeeks     = expandPlan(baseSessions, multipliers, raceDistances, currentWeeklyKm, timing.planWeeks, level)
  const startDate    = timing.startDate

  console.log('[PLAN] DB insert:', Date.now())

  // Store plan timeline metadata in preferences — avoids needing schema changes
  const updatedPrefs = { ...(context.user.preferences as Record<string, unknown>) }
  if (timing.userMessage) updatedPrefs.pre_plan_message = timing.userMessage
  else delete updatedPrefs.pre_plan_message
  updatedPrefs.plan_phase_label    = timing.phaseLabel
  // Phase boundary weeks (for dashboard block-label computation)
  updatedPrefs.plan_base_end_week  = timing.phases.baseWeeks
  updatedPrefs.plan_build_end_week = timing.phases.baseWeeks + timing.phases.buildWeeks
  updatedPrefs.plan_peak_end_week  = timing.phases.baseWeeks + timing.phases.buildWeeks + timing.phases.peakWeeks
  delete updatedPrefs.next_block_date
  await supabase.from('users').update({ preferences: updatedPrefs }).eq('id', userId)

  const isRacePlan = timing.planType !== 'base_building'
  const raceDate   = (targetDate && isRacePlan) ? new Date(targetDate + 'T12:00:00') : null
  const planEndDate = raceDate
    ? format(raceDate, 'yyyy-MM-dd')
    : format(addDays(startDate, timing.planWeeks * 7 - 1), 'yyyy-MM-dd')

  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({
      user_id:     userId,
      start_date:  format(startDate, 'yyyy-MM-dd'),
      end_date:    planEndDate,
      total_weeks: timing.planWeeks,
      status:      'active',
    })
    .select()
    .single()

  if (planError) throw new Error(`Failed to create training plan: ${planError.message}`)

  let rows = sessionsToRows(plan.id, userId, allWeeks, startDate, context.user.preferences)

  // Inject race week: strip sessions on/after race day, add RACE DAY marker
  if (raceDate && timing.planWeeks > 0) {
    const jsRaceDay  = raceDate.getDay()                  // 0=Sun … 6=Sat
    const raceDayDow = (jsRaceDay + 6) % 7               // 0=Mon … 6=Sun
    const eventType  = context.goal?.event_type ?? ''
    rows = processRaceWeek(rows, timing.planWeeks, raceDayDow, plan.id, userId, raceDate, eventType, context.user.disciplines ?? [])
    console.log(`[PLAN] Race week processed: raceDayDow=${raceDayDow} (${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][raceDayDow]})`)
  }

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
