import { useState } from 'react'

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
type Day = typeof ALL_DAYS[number]

// Sensible default day suggestions for each training volume
const DEFAULT_DAYS: Record<number, Day[]> = {
  3: ['Tue', 'Thu', 'Sat'],
  4: ['Tue', 'Thu', 'Sat', 'Sun'],
  5: ['Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
  6: ['Mon', 'Tue', 'Wed', 'Thu', 'Sat', 'Sun'],
  7: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

const DAY_TO_FULL: Record<Day, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
}

// Derive preferred_long_day from the selected days (prioritise weekend days)
export function inferPreferredLongDay(days: string[]): string {
  const preference: Day[] = ['Sat', 'Sun', 'Fri', 'Thu', 'Wed', 'Tue', 'Mon']
  const found = preference.find(d => days.includes(d))
  const fallback = days[days.length - 1] as Day | undefined
  return DAY_TO_FULL[found ?? fallback ?? 'Sat'] ?? 'Saturday'
}

interface Props {
  initialDaysPerWeek?: number
  initialSelectedDays?: string[]
  onNext: (data: { trainingDaysPerWeek: number; selectedDays: string[]; preferredLongDay: string }) => void
  onBack: () => void
}

export default function OnboardingStep3({ initialDaysPerWeek, initialSelectedDays = [], onNext, onBack }: Props) {
  const [daysPerWeek, setDaysPerWeek]     = useState<number | undefined>(initialDaysPerWeek)
  const [selectedDays, setSelectedDays]   = useState<string[]>(initialSelectedDays)

  function pickDaysPerWeek(n: number) {
    setDaysPerWeek(n)
    // Auto-suggest days when number changes; preserve existing selection if count matches
    if (selectedDays.length !== n) {
      setSelectedDays([...(DEFAULT_DAYS[n] ?? DEFAULT_DAYS[4])])
    }
  }

  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const canContinue = daysPerWeek !== undefined && selectedDays.length === daysPerWeek
  const tooMany     = daysPerWeek !== undefined && selectedDays.length > daysPerWeek
  const tooFew      = daysPerWeek !== undefined && selectedDays.length < daysPerWeek

  return (
    <div className="px-5 pb-8">
      {/* Progress */}
      <div className="pt-6 mb-7">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Step 3 of 4</span>
        <div className="flex gap-1.5 mt-2">
          {[1,2,3,4].map(i => (
            <div key={i} className={`flex-1 h-0.5 rounded-full ${i <= 3 ? 'bg-black' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-8 leading-snug">Your training availability</h1>

      {/* Q1: Days per week */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">How many days per week can you train?</h2>
        <p className="text-gray-500 text-sm mb-4">Your plan will never schedule more sessions than this.</p>
        <div className="flex gap-2">
          {[3, 4, 5, 6, 7].map(n => (
            <button
              key={n}
              onClick={() => pickDaysPerWeek(n)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                daysPerWeek === n
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {/* Q2: Which days */}
      {daysPerWeek !== undefined && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold">Which days do you prefer?</h2>
            <span className={`text-sm font-semibold tabular-nums ${canContinue ? 'text-green-600' : tooMany ? 'text-red-500' : 'text-gray-400'}`}>
              {selectedDays.length}/{daysPerWeek}
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            Select exactly {daysPerWeek} day{daysPerWeek !== 1 ? 's' : ''}.
          </p>
          <div className="grid grid-cols-4 gap-2">
            {ALL_DAYS.map(day => (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  selectedDays.includes(day)
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {day}
              </button>
            ))}
          </div>
          {tooMany && (
            <p className="text-red-500 text-xs mt-3">Too many selected — tap a highlighted day to remove it.</p>
          )}
          {tooFew && selectedDays.length > 0 && (
            <p className="text-gray-400 text-xs mt-3">Select {daysPerWeek - selectedDays.length} more day{daysPerWeek - selectedDays.length !== 1 ? 's' : ''}.</p>
          )}
        </section>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 border border-gray-200 font-semibold rounded-xl text-gray-700">
          Back
        </button>
        <button
          onClick={() => canContinue && onNext({
            trainingDaysPerWeek: daysPerWeek!,
            selectedDays,
            preferredLongDay: inferPreferredLongDay(selectedDays),
          })}
          disabled={!canContinue}
          className="flex-1 py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-40 text-base"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
