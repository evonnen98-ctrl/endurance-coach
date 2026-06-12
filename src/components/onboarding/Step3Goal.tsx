import { useState } from 'react'
import type { Discipline, TrainingPhase } from '../../types'

const EVENT_OPTIONS: Record<string, string[]> = {
  triathlon: ['Sprint Tri', 'Olympic Tri', '70.3 Half Iron', 'Ironman'],
  run: ['5km', '10km', 'Half Marathon', 'Marathon', 'Ultra'],
  ride: ['Gran Fondo', '100km', 'Stage Race', 'Century Ride'],
  swim: ['Open Water 1km', 'Open Water 5km', 'Masters Meet'],
}

function getEventOptions(disciplines: Discipline[], phase: TrainingPhase) {
  if (phase !== 'race') return []
  if (disciplines.length > 1) return EVENT_OPTIONS.triathlon
  if (disciplines.includes('run')) return EVENT_OPTIONS.run
  if (disciplines.includes('ride')) return EVENT_OPTIONS.ride
  if (disciplines.includes('swim')) return EVENT_OPTIONS.swim
  return []
}

interface Props {
  disciplines: Discipline[]
  phase: TrainingPhase
  eventType: string
  targetDate: string
  onNext: (eventType: string, targetDate: string) => void
  onBack: () => void
}

export default function Step3Goal({ disciplines, phase, eventType: initEvent, targetDate: initDate, onNext, onBack }: Props) {
  const [eventType, setEventType] = useState(initEvent)
  const [targetDate, setTargetDate] = useState(initDate)

  const events = getEventOptions(disciplines, phase)
  const showEventPicker = phase === 'race'

  const canContinue = phase !== 'race' || (eventType !== '')

  return (
    <div className="px-6">
      <h1 className="text-3xl font-bold mt-2 mb-1">Let's build your plan</h1>
      <div className="flex gap-2 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className={`flex-1 h-0.5 ${i <= 3 ? 'bg-black' : 'bg-gray-200'}`} />
        ))}
      </div>

      {showEventPicker ? (
        <>
          <h2 className="text-xl font-semibold mb-1">What's your goal event?</h2>
          <p className="text-gray-500 text-sm mb-6">Choose the format you're targeting.</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {events.map(e => (
              <button
                key={e}
                onClick={() => setEventType(e)}
                className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                  eventType === e
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-black hover:border-gray-400'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
            Target race date (optional)
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-base mb-8"
          />
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold mb-1">Any specific goals?</h2>
          <p className="text-gray-500 text-sm mb-6">Optional — you can set a goal any time.</p>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
            Target event or milestone (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Run a sub-20 5km"
            value={eventType}
            onChange={e => setEventType(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-base mb-4"
          />
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
            Target date (optional)
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-base mb-8"
          />
        </>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 border border-gray-200 font-semibold rounded-xl">
          Back
        </button>
        <button
          onClick={() => onNext(eventType, targetDate)}
          disabled={!canContinue}
          className="flex-1 py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
