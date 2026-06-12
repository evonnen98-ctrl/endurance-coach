import { useState } from 'react'
import type { TrainingPhase } from '../../types'

const OPTIONS: { value: TrainingPhase; emoji: string; label: string; desc: string }[] = [
  { value: 'race', emoji: '🎯', label: 'Training for a race', desc: 'I have a specific event or goal race' },
  { value: 'build', emoji: '📈', label: 'Building fitness', desc: 'No race planned, focused on getting stronger' },
  { value: 'maintain', emoji: '💪', label: 'Maintaining', desc: 'Keeping my current fitness level' },
  { value: 'return', emoji: '🔄', label: 'Returning from a break', desc: 'Coming back after injury or time off' },
]

interface Props {
  selected?: TrainingPhase
  onNext: (phase: TrainingPhase) => void
  onBack: () => void
}

export default function Step2Phase({ selected, onNext, onBack }: Props) {
  const [choice, setChoice] = useState<TrainingPhase | undefined>(selected)

  return (
    <div className="px-6">
      <h1 className="text-3xl font-bold mt-2 mb-1">Let's build your plan</h1>
      <div className="flex gap-2 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className={`flex-1 h-0.5 ${i <= 2 ? 'bg-black' : 'bg-gray-200'}`} />
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-1">What phase are you in?</h2>
      <p className="text-gray-500 text-sm mb-6">This shapes how your plan is structured.</p>

      <div className="space-y-3 mb-8">
        {OPTIONS.map(({ value, emoji, label, desc }) => (
          <button
            key={value}
            onClick={() => setChoice(value)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              choice === value
                ? 'border-black bg-black text-white'
                : 'border-gray-200 bg-white text-black hover:border-gray-400'
            }`}
          >
            <span className="text-2xl">{emoji}</span>
            <div>
              <div className="font-semibold">{label}</div>
              <div className={`text-sm ${choice === value ? 'text-gray-300' : 'text-gray-500'}`}>{desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 border border-gray-200 font-semibold rounded-xl">
          Back
        </button>
        <button
          onClick={() => choice && onNext(choice)}
          disabled={!choice}
          className="flex-1 py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
