import { useState } from 'react'
import type { Discipline } from '../../types'

const OPTIONS: { value: Discipline; label: string; emoji: string; desc: string }[] = [
  { value: 'swim', label: 'Swim', emoji: '🏊', desc: 'Pool or open water' },
  { value: 'ride', label: 'Ride', emoji: '🚴', desc: 'Road, gravel, or indoor' },
  { value: 'run', label: 'Run', emoji: '🏃', desc: 'Road or trail' },
]

interface Props {
  selected: Discipline[]
  onNext: (disciplines: Discipline[]) => void
}

export default function Step1Disciplines({ selected, onNext }: Props) {
  const [current, setCurrent] = useState<Discipline[]>(selected)

  function toggle(d: Discipline) {
    setCurrent(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  return (
    <div className="px-6">
      <h1 className="text-3xl font-bold mt-2 mb-1">Let's build your plan</h1>
      <div className="flex gap-2 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex-1 h-0.5 bg-black" />
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-1">Which disciplines do you train?</h2>
      <p className="text-gray-500 text-sm mb-6">Select all that apply.</p>

      <div className="space-y-3 mb-8">
        {OPTIONS.map(({ value, label, emoji, desc }) => {
          const isSelected = current.includes(value)
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

      <button
        onClick={() => current.length > 0 && onNext(current)}
        disabled={current.length === 0}
        className="w-full py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}
