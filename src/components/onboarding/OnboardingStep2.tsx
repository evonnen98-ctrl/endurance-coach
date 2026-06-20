import { useState } from 'react'
import type { Discipline, TrainingPhase } from '../../types'

function getEventOptions(disciplines: Discipline[]): string[] {
  const multi   = disciplines.length > 1
  const hasRun  = disciplines.includes('run')
  const hasRide = disciplines.includes('ride')
  const hasSwim = disciplines.includes('swim')
  if (multi)   return ['Sprint Tri', 'Olympic Tri', '70.3 Half Iron', 'Ironman', 'General fitness']
  if (hasRun)  return ['5km', '10km', 'Half Marathon', 'Marathon', 'Ultra', 'General fitness']
  if (hasRide) return ['Gran Fondo', 'Century Ride', 'FTP Improvement', 'General fitness']
  if (hasSwim) return ['Open Water 1km', 'Open Water 5km', 'Pool Event', 'General fitness']
  return ['General fitness']
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
  initialPlanStartDate?: string
  onNext: (data: { eventType: string; targetDate: string; planStartDate: string }) => void
  onBack: () => void
}

export default function OnboardingStep2({
  disciplines, phase,
  initialEventType = '', initialTargetDate = '', initialPlanStartDate,
  onNext, onBack,
}: Props) {
  const isRace  = phase === 'race'
  const options = getEventOptions(disciplines)

  const [eventType, setEventType]       = useState(initialEventType)
  const [targetDate, setTargetDate]     = useState(initialTargetDate)
  const [startOption, setStartOption]   = useState('Next Monday')
  const [planStartDate, setPlanStartDate] = useState(initialPlanStartDate ?? getNextMonday(0))

  function selectStart(label: string, offset: number) {
    setStartOption(label)
    if (offset >= 0) setPlanStartDate(getNextMonday(offset))
  }

  const canContinue = isRace ? (eventType !== '' && !!targetDate) : true

  return (
    <div className="px-5 pb-8">
      {/* Progress */}
      <div className="pt-6 mb-7">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Step 2 of 4</span>
        <div className="flex gap-1.5 mt-2">
          {[1,2,3,4].map(i => (
            <div key={i} className={`flex-1 h-0.5 rounded-full ${i <= 2 ? '' : 'bg-gray-200'}`} style={i <= 2 ? { backgroundColor: 'var(--lime-accent)' } : undefined} />
          ))}
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-8 leading-snug">Your goal</h1>

      {/* Q1: Event type */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">What are you training for?</h2>
        <p className="text-gray-500 text-sm mb-3">
          {isRace ? 'Choose your target event.' : 'Optional — pick one or leave blank.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => setEventType(eventType === opt ? '' : opt)}
              className={`py-3 px-3 rounded-xl border-2 text-sm font-medium text-center transition-all ${
                eventType === opt
                  ? 'border-transparent text-[#1a2400]'
                  : 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
              }`}
              style={eventType === opt ? { backgroundColor: 'var(--lime-accent)' } : undefined}
            >
              {opt}
            </button>
          ))}
        </div>
      </section>

      {/* Q2: Race date — only shown for race phase */}
      {isRace && (
        <section className="mb-8">
          <h2 className="text-base font-semibold mb-1">When is your race?</h2>
          <p className="text-gray-500 text-sm mb-3">Your plan adapts to this date — length, phases, and taper.</p>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl text-base"
          />
        </section>
      )}

      {/* Q3: Plan start date */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">When do you want to start?</h2>
        <p className="text-gray-500 text-sm mb-3">Plans begin on Mondays.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {START_OPTIONS.map(opt => (
            <button
              key={opt.label}
              type="button"
              onClick={() => selectStart(opt.label, opt.offset)}
              className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                startOption === opt.label
                  ? 'border-transparent text-[#1a2400]'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
              style={startOption === opt.label ? { backgroundColor: 'var(--lime-accent)' } : undefined}
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

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 border border-gray-200 font-semibold rounded-xl text-gray-700">
          Back
        </button>
        <button
          onClick={() => canContinue && onNext({ eventType, targetDate, planStartDate })}
          disabled={!canContinue}
          className="flex-1 py-4 font-semibold rounded-xl disabled:opacity-40 text-base"
          style={{ backgroundColor: 'var(--lime-accent)', color: '#1a2400' }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
