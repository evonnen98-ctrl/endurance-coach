// Sanity-check for race-distance long-session formula.
// Run with: npx tsx server/scripts/testLongSessions.ts

const TOTAL_WEEKS    = 20
const RACE_DISTANCES = { swim: 1.9, ride: 90, run: 21 }
const CURRENT_WEEKLY = { swim: 4,   ride: 50, run: 30 }

const round1 = (x: number) => Math.round(x * 10) / 10

const peakLong:  Record<string, number> = {}
const week1Long: Record<string, number> = {}
for (const disc of ['swim', 'ride', 'run'] as const) {
  const currentLong = round1(CURRENT_WEEKLY[disc] * 0.40)
  const targetPeak  = round1(RACE_DISTANCES[disc] * 0.90)
  peakLong[disc]  = Math.max(currentLong, targetPeak)
  week1Long[disc] = round1(Math.max(currentLong, peakLong[disc] * 0.45))
}

function calcWeekLong(wk: number, peak: number, w1: number, raceDist: number): number {
  const weeksFromEnd = TOTAL_WEEKS - wk
  const taperStart   = Math.max(TOTAL_WEEKS - 2, 2)
  if (weeksFromEnd === 0) return round1(raceDist * 0.30)
  if (weeksFromEnd <= 2)  return round1(peak * (weeksFromEnd === 1 ? 0.55 : 0.70))
  if (weeksFromEnd <= 4)  return round1(peak * (weeksFromEnd === 3 ? 0.95 : 1.00))
  if (wk % 4 === 0) {
    const prog = w1 + ((peak - w1) / (taperStart - 1)) * (wk - 1)
    return round1(prog * 0.80)
  }
  const progress = taperStart > 1 ? (wk - 1) / (taperStart - 1) : 0
  return round1(w1 + (peak - w1) * progress)
}

function phase(wk: number): string {
  const weeksFromEnd = TOTAL_WEEKS - wk
  if (weeksFromEnd === 0) return 'RACE WEEK'
  if (weeksFromEnd <= 2)  return 'TAPER'
  if (weeksFromEnd <= 4)  return 'PEAK'
  if (wk <= Math.floor(TOTAL_WEEKS * 0.40)) return 'base'
  return 'build'
}

console.log('\n=== Half Ironman — 20 weeks, intermediate ===')
console.log(`Peak long:   ride=${peakLong.ride}km  run=${peakLong.run}km  swim=${peakLong.swim}km`)
console.log(`Week-1 long: ride=${week1Long.ride}km  run=${week1Long.run}km  swim=${week1Long.swim}km`)
console.log('')
console.log('Wk  | Phase     | Long ride | Long run | Long swim')
console.log('----+-----------+-----------+----------+----------')

const HIGHLIGHT = [1, 8, 16, 17, 18, 20]
for (let wk = 1; wk <= TOTAL_WEEKS; wk++) {
  const ride = calcWeekLong(wk, peakLong.ride, week1Long.ride, RACE_DISTANCES.ride)
  const run  = calcWeekLong(wk, peakLong.run,  week1Long.run,  RACE_DISTANCES.run)
  const swim = calcWeekLong(wk, peakLong.swim, week1Long.swim, RACE_DISTANCES.swim)
  const ph   = phase(wk)
  const recovery = wk % 4 === 0 && !['TAPER','PEAK','RACE WEEK'].includes(ph) ? ' [rec]' : ''
  const mark = HIGHLIGHT.includes(wk) ? '→' : ' '
  console.log(`${mark} ${String(wk).padStart(2)} | ${ph.padEnd(9)} | ${String(ride).padEnd(9)} | ${String(run).padEnd(8)} | ${swim}${recovery}`)
}
