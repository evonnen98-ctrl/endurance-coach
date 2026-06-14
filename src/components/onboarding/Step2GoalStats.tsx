import { useState } from 'react'
import type { Discipline, TrainingPhase } from '../../types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const RACE_EVENTS: Record<string, string[]> = {
  multi:  ['Sprint Tri', 'Olympic Tri', '70.3 Half Iron', 'Ironman'],
  run:    ['5km', '10km', 'Half Marathon', 'Marathon', 'Ultra'],
  ride:   ['Gran Fondo', '100km', 'Stage Race', 'Century Ride'],
  swim:   ['Open Water 1km', 'Open Water 5km', 'Masters Meet'],
}

function getRaceEvents(disciplines: Discipline[]): string[] {
  if (disciplines.length > 1) return RACE_EVENTS.multi
  if (disciplines.includes('run')) return RACE_EVENTS.run
  if (disciplines.includes('ride')) return RACE_EVENTS.ride
  if (disciplines.includes('swim')) return RACE_EVENTS.swim
  return []
}

function getNextMonday(offsetWeeks = 0): string {
  const now = new Date()
  const day = now.getDay()
  const toMon = day === 1 ? 7 : (8 - day) % 7 || 7
  const d = new Date(now)
  d.setDate(now.getDate() + toMon + offsetWeeks * 7)
  return d.toISOString().slice(0, 10)
}

const START_OPTIONS = [
  { label: 'Next Monday', offset: 0 },
  { label: 'In 2 weeks',  offset: 2 },
  { label: 'In 4 weeks',  offset: 4 },
  { label: 'Custom date', offset: -1 },
] as const

interface Props {
  disciplines: Discipline[]
  phase: TrainingPhase
  initialEventType?: string
  initialTargetDate?: string
  initialStats?: Record<string, string>
  initialSelectedDays?: string[]
  initialCoachNote?: string
  onNext: (data: {
    eventType: string
    targetDate: string
    planStartDate: string
    stats: Record<string, string>
    coachNote: string
    selectedDays: string[]
  }) => void
  onBack: () => void
}

export default function Step2GoalStats({
  disciplines, phase,
  initialEventType = '', initialTargetDate = '',
  initialStats = {}, initialSelectedDays = [], initialCoachNote = '',
  onNext, onBack,
}: Props) {
  const [eventType, setEventType] = useState(initialEventType)
  const [targetDate, setTargetDate] = useState(initialTargetDate)
  const [startOption, setStartOption] = useState('Next Monday')
  const [planStartDate, setPlanStartDate] = useState(() => getNextMonday(0))
  const [stats, setStats] = useState<Record<string, string>>(initialStats)
  const [coachNote, setCoachNote] = useState(initialCoachNote)
  const [selectedDays, setSelectedDays] = useState<string[]>(initialSelectedDays)

  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  function selectStart(label: string, offset: number) {
    setStartOption(label)
    if (offset >= 0) setPlanStartDate(getNextMonday(offset))
  }

  const isRace = phase === 'race'
  const events = getRaceEvents(disciplines)

  const set = (key: string, val: string) => setStats(s => ({ ...s, [key]: val }))

  const hasVolumes = disciplines.every(d =>
    d === 'run'  ? (parseFloat(stats.run_weekly_km  ?? '') || 0) > 0
    : d === 'ride' ? (parseFloat(stats.ride_weekly_km ?? '') || 0) > 0
    : d === 'swim' ? (parseFloat(stats.swim_weekly_km ?? '') || 0) > 0
    : true
  )
  const canContinue = (isRace ? (eventType !== '' && !!targetDate) : true) && hasVolumes

  return (
    <div className="px-6 pb-8">
      <h1 className="text-3xl font-bold mt-2 mb-1">Your goal &amp; profile</h1>
      <div className="flex gap-2 mb-8">
        {[1, 2].map(i => (
          <div key={i} className={`flex-1 h-0.5 bg-black`} />
        ))}
      </div>

      {/* ── Goal ── */}
      {isRace ? (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-1">What's your goal event?</h2>
            <p className="text-gray-500 text-sm mb-4">Choose the format you're targeting.</p>
            <div className="grid grid-cols-2 gap-2">
              {events.map(e => (
                <button
                  key={e}
                  onClick={() => setEventType(e)}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    eventType === e
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-1">When is your race?</h2>
            <p className="text-gray-500 text-sm mb-4">Your plan length and structure adapts to this date.</p>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-base"
            />
          </section>
        </>
      ) : (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-1">Any specific goals?</h2>
          <p className="text-gray-500 text-sm mb-4">Optional — you can set a goal any time.</p>
          <input
            type="text"
            placeholder="e.g. Run a sub-20 5km, complete my first century ride"
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-base mb-4"
          />
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Target date (optional)
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-base"
          />
        </section>
      )}

      {/* ── Stats per discipline ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Where you are today</h2>
        <p className="text-gray-500 text-sm mb-4">Rough numbers are fine — helps calibrate your plan.</p>

        <div className="space-y-4">
          {disciplines.includes('run') && (
            <div className="p-4 rounded-xl border-2 border-gray-100 bg-gray-50">
              <p className="font-semibold text-sm mb-3 text-gray-700">Running</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block min-h-[2rem] text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Weekly km
                  </label>
                  <input
                    type="number"
                    placeholder="35"
                    value={stats.run_weekly_km ?? ''}
                    onChange={e => set('run_weekly_km', e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
                  />
                </div>
                <div>
                  <label className="block min-h-[2rem] text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Easy pace <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="5:30"
                    value={stats.run_pace ?? ''}
                    onChange={e => set('run_pace', e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
                  />
                </div>
              </div>
            </div>
          )}

          {disciplines.includes('ride') && (
            <div className="p-4 rounded-xl border-2 border-gray-100 bg-gray-50">
              <p className="font-semibold text-sm mb-3 text-gray-700">Cycling</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block min-h-[2rem] text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Weekly km
                  </label>
                  <input
                    type="number"
                    placeholder="120"
                    value={stats.ride_weekly_km ?? ''}
                    onChange={e => set('ride_weekly_km', e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
                  />
                </div>
                <div>
                  <label className="block min-h-[2rem] text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Avg speed <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="28"
                    value={stats.ride_speed ?? ''}
                    onChange={e => set('ride_speed', e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
                  />
                </div>
              </div>
            </div>
          )}

          {disciplines.includes('swim') && (
            <div className="p-4 rounded-xl border-2 border-gray-100 bg-gray-50">
              <p className="font-semibold text-sm mb-3 text-gray-700">Swimming</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block min-h-[2rem] text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Weekly km
                  </label>
                  <input
                    type="number"
                    placeholder="5"
                    value={stats.swim_weekly_km ?? ''}
                    onChange={e => set('swim_weekly_km', e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
                  />
                </div>
                <div>
                  <label className="block min-h-[2rem] text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    100m pace <span className="normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="1:45"
                    value={stats.swim_pace_per_100m ?? ''}
                    onChange={e => set('swim_pace_per_100m', e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Training days ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Which days can you train? <span className="text-sm font-normal text-gray-400">(optional)</span></h2>
        <p className="text-gray-500 text-sm mb-4">Select all that apply — your plan will respect these.</p>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                selectedDays.includes(day)
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </section>

      {/* ── Plan start date ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">When do you want to start?</h2>
        <p className="text-gray-500 text-sm mb-4">Plans begin on Mondays.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {START_OPTIONS.map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => selectStart(opt.label, opt.offset)}
              className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                startOption === opt.label
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {startOption === 'Custom date' && (
          <input
            type="date"
            value={planStartDate}
            onChange={e => setPlanStartDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-base"
          />
        )}
      </section>

      {/* ── Coach note ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Anything your coach should know? <span className="text-sm font-normal text-gray-400">(optional)</span></h2>
        <textarea
          rows={3}
          placeholder="Training preferences, injury history, sessions you prefer to do in the morning…"
          value={coachNote}
          onChange={e => setCoachNote(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-xl text-base resize-none"
        />
      </section>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-4 border border-gray-200 font-semibold rounded-xl text-gray-600"
        >
          Back
        </button>
        <button
          onClick={() => onNext({
            eventType,
            targetDate,
            planStartDate,
            stats,
            coachNote,
            selectedDays,
          })}
          disabled={!canContinue}
          className="flex-1 py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-40"
        >
          Build my plan
        </button>
      </div>
    </div>
  )
}
