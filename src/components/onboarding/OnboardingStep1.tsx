import { useState } from 'react'
import type { Discipline, TrainingPhase } from '../../types'

type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'competitive'

const DISCIPLINES = [
  { value: 'swim' as Discipline, emoji: '🏊', label: 'Swim', desc: 'Pool or open water' },
  { value: 'ride' as Discipline, emoji: '🚴', label: 'Ride', desc: 'Road, gravel, or indoor' },
  { value: 'run'  as Discipline, emoji: '🏃', label: 'Run',  desc: 'Road or trail' },
]

const PHASES = [
  { value: 'race'     as TrainingPhase, emoji: '🎯', label: 'Training for a race',    desc: 'I have a specific event or goal race' },
  { value: 'build'    as TrainingPhase, emoji: '📈', label: 'Building fitness',        desc: 'No race planned, focused on getting stronger' },
  { value: 'maintain' as TrainingPhase, emoji: '💪', label: 'Maintaining',             desc: 'Keeping my current fitness level' },
  { value: 'return'   as TrainingPhase, emoji: '🔄', label: 'Returning from a break',  desc: 'Coming back after injury or time off' },
]

const FITNESS = [
  { value: 'beginner'     as FitnessLevel, emoji: '🌱', label: 'Beginner',     desc: 'New to endurance sport or returning after a long break' },
  { value: 'intermediate' as FitnessLevel, emoji: '📈', label: 'Intermediate', desc: 'Training consistently, completed some events' },
  { value: 'advanced'     as FitnessLevel, emoji: '💪', label: 'Advanced',     desc: 'High volume, racing regularly' },
  { value: 'competitive'  as FitnessLevel, emoji: '🏆', label: 'Competitive',  desc: 'Podium-focused, high weekly hours' },
]

interface Props {
  initialDisciplines?: Discipline[]
  initialPhase?: TrainingPhase
  initialFitnessLevel?: FitnessLevel
  onNext: (disciplines: Discipline[], phase: TrainingPhase, fitnessLevel: FitnessLevel) => void
}

function Card({ selected, onClick, emoji, label, desc }: { selected: boolean; onClick: () => void; emoji: string; label: string; desc: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
        selected ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-900 hover:border-gray-400'
      }`}
    >
      <span className="text-xl flex-shrink-0">{emoji}</span>
      <div>
        <div className="font-semibold text-sm leading-tight">{label}</div>
        <div className={`text-xs mt-0.5 leading-tight ${selected ? 'text-gray-300' : 'text-gray-500'}`}>{desc}</div>
      </div>
    </button>
  )
}

export default function OnboardingStep1({ initialDisciplines = [], initialPhase, initialFitnessLevel, onNext }: Props) {
  const [disciplines, setDisciplines] = useState<Discipline[]>(initialDisciplines)
  const [phase, setPhase]             = useState<TrainingPhase | undefined>(initialPhase)
  const [fitness, setFitness]         = useState<FitnessLevel | undefined>(initialFitnessLevel)

  function toggleDisc(d: Discipline) {
    setDisciplines(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const canContinue = disciplines.length > 0 && phase !== undefined && fitness !== undefined

  return (
    <div className="px-5 pb-8">
      {/* Progress */}
      <div className="pt-6 mb-7">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Step 1 of 4</span>
        <div className="flex gap-1.5 mt-2">
          {[1,2,3,4].map(i => (
            <div key={i} className={`flex-1 h-0.5 rounded-full ${i <= 1 ? 'bg-black' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-8 leading-snug">Who are you as an athlete?</h1>

      {/* Q1: Disciplines */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">What disciplines do you train?</h2>
        <p className="text-gray-500 text-sm mb-3">Select all that apply.</p>
        <div className="space-y-2">
          {DISCIPLINES.map(d => (
            <Card key={d.value} selected={disciplines.includes(d.value)} onClick={() => toggleDisc(d.value)} emoji={d.emoji} label={d.label} desc={d.desc} />
          ))}
        </div>
      </section>

      {/* Q2: Training phase */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">What phase are you in?</h2>
        <p className="text-gray-500 text-sm mb-3">This shapes how your plan is structured.</p>
        <div className="space-y-2">
          {PHASES.map(p => (
            <Card key={p.value} selected={phase === p.value} onClick={() => setPhase(p.value)} emoji={p.emoji} label={p.label} desc={p.desc} />
          ))}
        </div>
      </section>

      {/* Q3: Fitness level */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">How would you describe your fitness?</h2>
        <p className="text-gray-500 text-sm mb-3">This sets realistic volumes for your plan.</p>
        <div className="space-y-2">
          {FITNESS.map(f => (
            <Card key={f.value} selected={fitness === f.value} onClick={() => setFitness(f.value)} emoji={f.emoji} label={f.label} desc={f.desc} />
          ))}
        </div>
      </section>

      <button
        onClick={() => canContinue && onNext(disciplines, phase!, fitness!)}
        disabled={!canContinue}
        className="w-full py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-40 text-base"
      >
        Continue
      </button>
    </div>
  )
}
