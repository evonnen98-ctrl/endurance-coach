import { useState } from 'react'
import type { Discipline, TrainingPhase } from '../../types'

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive'

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

const FITNESS_LEVELS: { value: FitnessLevel; emoji: string; label: string; desc: string }[] = [
  { value: 'beginner',     emoji: '🌱', label: 'Beginner',     desc: 'New to endurance sport or returning after a long break' },
  { value: 'intermediate', emoji: '📈', label: 'Intermediate', desc: 'Training consistently, completed some events' },
  { value: 'advanced',     emoji: '💪', label: 'Advanced',     desc: 'High volume, racing regularly' },
  { value: 'competitive',  emoji: '🏆', label: 'Competitive',  desc: 'Podium-focused, high weekly hours' },
]

const DAY_OPTIONS = [3, 4, 5, 6, 7]
const LONG_DAY_OPTIONS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface Props {
  initialDisciplines: Discipline[]
  initialPhase?: TrainingPhase
  initialFitnessLevel?: FitnessLevel
  initialTrainingDays?: number
  initialPreferredLongDay?: string
  onNext: (disciplines: Discipline[], phase: TrainingPhase, fitnessLevel: FitnessLevel, trainingDaysPerWeek: number, preferredLongDay: string) => void
}

export default function Step1DisciplinesPhase({
  initialDisciplines, initialPhase, initialFitnessLevel, initialTrainingDays, initialPreferredLongDay, onNext,
}: Props) {
  const [disciplines, setDisciplines]         = useState<Discipline[]>(initialDisciplines)
  const [phase, setPhase]                     = useState<TrainingPhase | undefined>(initialPhase)
  const [fitnessLevel, setFitnessLevel]       = useState<FitnessLevel | undefined>(initialFitnessLevel)
  const [trainingDays, setTrainingDays]       = useState<number | undefined>(initialTrainingDays)
  const [preferredLongDay, setPreferredLongDay] = useState<string | undefined>(initialPreferredLongDay)

  function toggle(d: Discipline) {
    setDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const canContinue = disciplines.length > 0 && phase !== undefined && fitnessLevel !== undefined && trainingDays !== undefined && preferredLongDay !== undefined

  return (
    <div className="px-6 pb-8">
      <h1 className="text-3xl font-bold mt-2 mb-1">Let's build your plan</h1>
      <div className="flex gap-2 mb-8">
        {[1, 2].map(i => (
          <div key={i} className={`flex-1 h-0.5 ${i <= 1 ? 'bg-black' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* Disciplines */}
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

      {/* Training phase */}
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

      {/* Fitness level */}
      <h2 className="text-xl font-semibold mb-1">What's your fitness level?</h2>
      <p className="text-gray-500 text-sm mb-4">This sets realistic volumes for your plan.</p>
      <div className="space-y-2 mb-8">
        {FITNESS_LEVELS.map(({ value, emoji, label, desc }) => (
          <button
            key={value}
            onClick={() => setFitnessLevel(value)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              fitnessLevel === value
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-black hover:border-gray-400'
            }`}
          >
            <span className="text-2xl">{emoji}</span>
            <div>
              <div className="font-semibold">{label}</div>
              <div className={`text-sm ${fitnessLevel === value ? 'text-gray-300' : 'text-gray-500'}`}>{desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Days per week */}
      <h2 className="text-xl font-semibold mb-1">How many days a week can you train?</h2>
      <p className="text-gray-500 text-sm mb-4">Your plan will never schedule more sessions than this.</p>
      <div className="flex gap-2 mb-8">
        {DAY_OPTIONS.map(d => (
          <button
            key={d}
            onClick={() => setTrainingDays(d)}
            className={`flex-1 py-4 rounded-xl border-2 text-lg font-bold transition-all ${
              trainingDays === d
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-black hover:border-gray-400'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Preferred long day */}
      <h2 className="text-xl font-semibold mb-1">When do you do your long session?</h2>
      <p className="text-gray-500 text-sm mb-4">Your long run, ride, or swim will always land on this day.</p>
      <div className="grid grid-cols-4 gap-2 mb-8">
        {LONG_DAY_OPTIONS.map(day => (
          <button
            key={day}
            onClick={() => setPreferredLongDay(day)}
            className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
              preferredLongDay === day
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            {day.slice(0, 3)}
          </button>
        ))}
      </div>

      <button
        onClick={() => canContinue && onNext(disciplines, phase!, fitnessLevel!, trainingDays!, preferredLongDay!)}
        disabled={!canContinue}
        className="w-full py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}
