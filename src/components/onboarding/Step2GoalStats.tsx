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

interface Props {
  disciplines: Discipline[]
  phase: TrainingPhase
  onNext: (data: {
    eventType: string
    targetDate: string
    stats: Record<string, string>
    coachNote: string
  }) => void
  onBack: () => void
}

export default function Step2GoalStats({ disciplines, phase, onNext, onBack }: Props) {
  const [eventType, setEventType] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [stats, setStats] = useState<Record<string, string>>({})
  const [coachNote, setCoachNote] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])

  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const isRace = phase === 'race'
  const events = getRaceEvents(disciplines)

  const set = (key: string, val: string) => setStats(s => ({ ...s, [key]: val }))

  const canContinue = !isRace || eventType !== ''

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
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-1">What's your goal event?</h2>
          <p className="text-gray-500 text-sm mb-4">Choose the format you're targeting.</p>
          <div className="grid grid-cols-2 gap-2 mb-5">
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
          <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Target race date (optional)
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-base"
          />
        </section>
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
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
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
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Easy pace (min/km)
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
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
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
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Avg speed (km/h)
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
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    100m pace (min:sec)
                  </label>
                  <input
                    type="text"
                    placeholder="1:45"
                    value={stats.swim_pace_per_100m ?? ''}
                    onChange={e => set('swim_pace_per_100m', e.target.value)}
                    className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Typical session (m)
                  </label>
                  <input
                    type="number"
                    placeholder="2000"
                    value={stats.swim_session_distance_m ?? ''}
                    onChange={e => set('swim_session_distance_m', e.target.value)}
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
        <h2 className="text-lg font-semibold mb-1">Which days can you train?</h2>
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

      {/* ── Coach note ── */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Anything your coach should know?</h2>
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
            stats: { ...stats, training_days: selectedDays.join(',') },
            coachNote,
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
