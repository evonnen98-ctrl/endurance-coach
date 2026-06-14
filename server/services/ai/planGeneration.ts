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

// ── Taper config by goal type ─────────────────────────────────────────────────

interface TaperConfig {
  multipliers: readonly number[]
  peakMultiplier: number
}

function getTaperConfig(goalRaw: string): TaperConfig {
  const goal = detectGoalType(goalRaw)
  if (goal === 'marathon' || goal === '70.3' || goal === 'ironman') {
    return {
      multipliers:    [1.00, 1.05, 1.10, 0.85, 1.15, 1.20, 1.25, 0.90, 1.30, 0.85, 0.70, 0.50],
      peakMultiplier: 1.30,
    }
  }
  if (goal === 'half_marathon' || goal === 'olympic_tri' || goal === 'sprint_tri') {
    return {
      multipliers:    [1.00, 1.05, 1.10, 0.85, 1.15, 1.20, 1.25, 0.90, 1.30, 1.35, 0.80, 0.55],
      peakMultiplier: 1.35,
    }
  }
  return {
    multipliers:    [1.00, 1.05, 1.10, 0.85, 1.15, 1.20, 1.25, 0.90, 1.30, 1.35, 1.15, 0.65],
    peakMultiplier: 1.35,
  }
}

// ── Template-based weekly schedule ───────────────────────────────────────────
//
// Returns an ordered list of { disc, type, kmShare, minPerKm } slots.
// kmShare is a fraction of the weekly volume for that discipline.
// Slots are placed starting from Monday (day 0), with rest days inserted
// to honour the "long ride and long run separated by 2+ days" rule.
//
// The day indices returned are the absolute 0-6 (Mon-Sun) positions.
// preferred_long_day shifts where the long ride lands within the week.

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
// Long ride on longRideDay; long run on longRunDay (always 2+ days away from ride).
function buildWeekTemplate(
  daysPerWeek: number,
  discSet: DisciplineSet,
  longDayIdx: number,         // preferred long session day (0-6)
  level: FitnessLevel,
  hasQuality: boolean,        // whether quality sessions are allowed
): Array<{ dayIdx: number; slot: Slot }> {

  // For single-discipline athletes the long day is the preferred day.
  // For triathlon we put the long RIDE on preferred day and long RUN 2 days later.
  const longRideDay = longDayIdx
  const longRunDay  = (longDayIdx + 2) % 7

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

    // Spread day indices: long day first, then greedy max-gap
    const dayIdxs = spreadDays(n, longDayIdx)
    return dayIdxs.map((dayIdx, i) => ({ dayIdx, slot: slots[i] }))
  }

  // ----- Multi-discipline templates -----
  // Triathlete (all) or duathlete (run+ride / run+swim / ride+swim)
  const hasRun  = discSet === 'all' || discSet.startsWith('run')  || discSet.endsWith('run')
  const hasRide = discSet === 'all' || discSet.startsWith('ride') || discSet.endsWith('ride')
  const hasSwim = discSet === 'all' || discSet.startsWith('swim') || discSet.endsWith('swim')

  type Entry = { dayIdx: number; disc: 'run' | 'ride' | 'swim'; type: string; kmShare: number; minPerKm: number }
  const entries: Entry[] = []

  // Templates by daysPerWeek for triathlete (adjust for duathletes by removing swim)
  // Each entry: [discipline, type, day-offset-from-Monday]
  // We always anchor long-ride on longRideDay and long-run on longRunDay.

  if (daysPerWeek <= 3) {
    // 3 days: one of each (swim optional if no swim disc)
    const plan: Array<[string, string, number]> = []
    if (hasSwim) plan.push(['swim', 'base',  0])
    if (hasRide) plan.push(['ride', 'long',  longRideDay - (longRideDay > 2 ? 2 : 0)])
    if (hasRun)  plan.push(['run',  'long',  longRunDay])
    // Fill to 3 if short
    const actual = plan.slice(0, 3)
    actual.forEach(([disc, type, dayIdx]) => {
      if ((disc === 'run'  && !hasRun)  ||
          (disc === 'ride' && !hasRide) ||
          (disc === 'swim' && !hasSwim)) return
      entries.push({ dayIdx, disc: disc as 'run'|'ride'|'swim', type, kmShare: 0, minPerKm: disc === 'run' ? 6.5 : disc === 'ride' ? 2.2 : 30 })
    })
  } else if (daysPerWeek === 4) {
    // Day 0: Swim easy / or ride easy if no swim
    // Day 2: Run easy
    // Day 4: Ride long  ← longRideDay
    // Day 6: Run long   ← longRunDay
    if (hasSwim) entries.push({ dayIdx: (longRideDay + 4) % 7, disc: 'swim', type: 'base',  kmShare: 0, minPerKm: 30 })
    else if (hasRide) entries.push({ dayIdx: (longRideDay + 5) % 7, disc: 'ride', type: 'easy', kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: (longRideDay + 2) % 7, disc: 'run',  type: 'easy',  kmShare: 0, minPerKm: 6.5 })
    if (hasRide) entries.push({ dayIdx: longRideDay,            disc: 'ride', type: 'long',  kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: longRunDay,             disc: 'run',  type: 'long',  kmShare: 0, minPerKm: 6.5 })
  } else if (daysPerWeek === 5) {
    // Day A: Swim easy
    // Day B: Run easy
    // Day C: Ride tempo/easy
    // Day D: Swim intervals (if tri) or Run tempo (if no swim)
    // Day E: Ride long (longRideDay)
    // Day F: Run long  (longRunDay)
    // Anchor E and F, spread A-D around them
    const anchor1 = longRideDay
    const anchor2 = longRunDay
    const other: number[] = []
    for (let d = 0; d < 7; d++) {
      if (d !== anchor1 && d !== anchor2) other.push(d)
    }
    // Pick 3 non-anchor days, maximally spread from anchors
    const spread3 = pickSpread(other, 3, [anchor1, anchor2])

    if (hasSwim) {
      entries.push({ dayIdx: spread3[0], disc: 'swim', type: 'base',     kmShare: 0, minPerKm: 30 })
      entries.push({ dayIdx: spread3[2], disc: 'swim', type: 'interval', kmShare: 0, minPerKm: 30 })
    } else if (hasRun) {
      entries.push({ dayIdx: spread3[0], disc: 'run', type: 'easy',  kmShare: 0, minPerKm: 6.5 })
      entries.push({ dayIdx: spread3[2], disc: 'run', type: hasQuality ? 'tempo' : 'easy', kmShare: 0, minPerKm: 5.5 })
    }
    if (hasRun)  entries.push({ dayIdx: spread3[1], disc: 'run',  type: 'easy',  kmShare: 0, minPerKm: 6.5 })
    if (hasRide) entries.push({ dayIdx: anchor1,    disc: 'ride', type: 'long',  kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: anchor2,    disc: 'run',  type: 'long',  kmShare: 0, minPerKm: 6.5 })
  } else {
    // 6 days: full triathlete week
    // Mon: Swim easy
    // Tue: Run easy
    // Wed: Ride tempo
    // Thu: Run tempo/intervals
    // Fri: Swim intervals
    // Sat: Ride long   ← longRideDay
    // Sun: Run long    ← longRunDay
    // Anchor long ride + long run, fill the 4 remaining slots
    const anchor1 = longRideDay
    const anchor2 = longRunDay
    const others: number[] = []
    for (let d = 0; d < 7; d++) {
      if (d !== anchor1 && d !== anchor2) others.push(d)
    }
    const spread4 = pickSpread(others, 4, [anchor1, anchor2])

    if (hasSwim) {
      entries.push({ dayIdx: spread4[0], disc: 'swim', type: 'base',     kmShare: 0, minPerKm: 30 })
      entries.push({ dayIdx: spread4[3], disc: 'swim', type: 'interval', kmShare: 0, minPerKm: 30 })
    }
    if (hasRun) {
      entries.push({ dayIdx: spread4[1], disc: 'run',  type: 'easy',  kmShare: 0, minPerKm: 6.5 })
      entries.push({ dayIdx: spread4[2], disc: 'run',  type: hasQuality ? 'tempo' : 'easy', kmShare: 0, minPerKm: 5.5 })
    }
    if (hasRide) entries.push({ dayIdx: anchor1, disc: 'ride', type: 'long', kmShare: 0, minPerKm: 2.2 })
    if (hasRun)  entries.push({ dayIdx: anchor2, disc: 'run',  type: 'long', kmShare: 0, minPerKm: 6.5 })

    // Add a non-long ride if we still have room
    const used = new Set(entries.map(e => e.dayIdx))
    if (hasRide && entries.length < daysPerWeek) {
      const rideDay = others.find(d => !used.has(d))
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

// Spread n days across 0-6 starting from preferred, maximally separated
function spreadDays(n: number, preferred: number): number[] {
  const result: number[] = [preferred]
  for (let i = 1; i < n; i++) {
    let best = -1, bestScore = -1
    for (let d = 0; d < 7; d++) {
      if (result.includes(d)) continue
      const minDist = Math.min(...result.map(r => {
        const diff = Math.abs(r - d)
        return Math.min(diff, 7 - diff)
      }))
      if (minDist > bestScore) { bestScore = minDist; best = d }
    }
    if (best !== -1) result.push(best)
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

function buildBaseWeek(ctx: UserContext, taperConfig: TaperConfig): AiSession[] {
  const { disciplines, training_phase, preferences } = ctx.user

  // Discipline filtering — ONLY create sessions for athlete's chosen disciplines
  const allowedDiscs = new Set(disciplines.filter(d => ['run', 'ride', 'swim'].includes(d)))
  if (allowedDiscs.size === 0) allowedDiscs.add('run') // safe default

  const level       = ((preferences.fitness_level as string) ?? 'intermediate') as FitnessLevel
  const daysPerWeek = Math.min(Number(preferences.training_days_per_week) || 4, 7)
  const longDayRaw  = (preferences.preferred_long_day as string ?? 'Saturday')
  const longDayIdx  = DAY_INDEX[longDayRaw.toLowerCase()] ?? 5
  const isReturn    = training_phase === 'return'
  const goalType    = ctx.goal?.event_type ?? (preferences.goal_event_type as string ?? '')
  const caps        = getCapsForGoal(level, goalType)
  const startPct    = isReturn ? 0.60 : 0.90
  const { peakMultiplier } = taperConfig

  const hasQuality = level !== 'beginner' && !isReturn

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
  const template = buildWeekTemplate(daysPerWeek, discSet, longDayIdx, level, hasQuality)

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

// ── 12-week expansion ─────────────────────────────────────────────────────────

function expandToTwelveWeeks(
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
  const taperConfig = getTaperConfig(goalType)

  const baseSessions = buildBaseWeek(context, taperConfig)
  const allWeeks     = expandToTwelveWeeks(baseSessions, taperConfig.multipliers)

  function nextOrSameMonday(d: Date): Date {
    const day = d.getDay()
    if (day === 1) return d
    const offset = day === 0 ? 1 : 8 - day
    const m = new Date(d)
    m.setDate(d.getDate() + offset)
    return m
  }

  const planStartPref = context.user.preferences.plan_start_date as string | undefined
  const startDate = planStartPref
    ? nextOrSameMonday(new Date(planStartPref + 'T12:00:00'))
    : (() => {
        const now = new Date()
        const day = now.getDay()
        const offset = (8 - day) % 7 || 7
        const m = new Date(now)
        m.setDate(now.getDate() + offset)
        return m
      })()

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
