import { useState } from 'react'
import type { Discipline, TrainingPhase } from '../../types'

const DISCIPLINE_OPTIONS: { value: Discipline; label: string; emoji: string; desc: string }[] = [
  { value: 'swim', label: 'Swim', emoji: '🏊', desc: 'Pool or open water' },
  { value: 'ride', label: 'Ride', emoji: '🚴', desc: 'Road, gravel, or indoor' },
  { value: 'run',  label: 'Run',  emoji: '🏃', desc: 'Road or trail' },
]

const PHASE_OPTIONS: { value: TrainingPhase; emoji: string; label: string; desc: string }[] = [
  { value: 'race',     emoji: '🎯', label: 'Training for a race',     desc: 'I have a specific event or goal race' },
  { value: 'build',    emoji: '📈', label: 'Building fitness',         desc: 'No race planned, focused on getting stronger' },
  { value: 'maintain', emoji: '💪', label: 'Maintaining',              desc: 'Keeping my current fitness level' },
  { value: 'return',   emoji: '🔄', label: 'Returning from a break',   desc: 'Coming back after injury or time off' },
]

interface Props {
  initialDisciplines: Discipline[]
  initialPhase?: TrainingPhase
  onNext: (disciplines: Discipline[], phase: TrainingPhase) => void
}

export default function Step1DisciplinesPhase({ initialDisciplines, initialPhase, onNext }: Props) {
  const [disciplines, setDisciplines] = useState<Discipline[]>(initialDisciplines)
  const [phase, setPhase] = useState<TrainingPhase | undefined>(initialPhase)

  function toggle(d: Discipline) {
    setDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const canContinue = disciplines.length > 0 && phase !== undefined

  return (
    <div className="px-6 pb-8">
      <h1 className="text-3xl font-bold mt-2 mb-1">Let's build your plan</h1>
      <div className="flex gap-2 mb-8">
        {[1, 2].map(i => (
          <div key={i} className={`flex-1 h-0.5 ${i <= 1 ? 'bg-black' : 'bg-gray-200'}`} />
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-1">Which disciplines do you train?</h2>
      <p className="text-gray-500 text-sm mb-4">Select all that apply.</p>

      <div className="space-y-2 mb-7">
        {DISCIPLINE_OPTIONS.map(({ value, label, emoji, desc }) => {
          const isSelected = disciplines.includes(value)
          return (
            <button
              key={value}
              onClick={() => toggle(value)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-black hover:border-gray-400'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <div>
                <div className="font-semibold">{label}</div>
                <div className={`text-sm ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>{desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      <h2 className="text-xl font-semibold mb-1">What phase are you in?</h2>
      <p className="text-gray-500 text-sm mb-4">This shapes how your plan is structured.</p>

      <div className="space-y-2 mb-8">
        {PHASE_OPTIONS.map(({ value, emoji, label, desc }) => (
          <button
            key={value}
            onClick={() => setPhase(value)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              phase === value
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-black hover:border-gray-400'
            }`}
          >
            <span className="text-2xl">{emoji}</span>
            <div>
              <div className="font-semibold">{label}</div>
              <div className={`text-sm ${phase === value ? 'text-gray-300' : 'text-gray-500'}`}>{desc}</div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => canContinue && onNext(disciplines, phase!)}
        disabled={!canContinue}
        className="w-full py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}
