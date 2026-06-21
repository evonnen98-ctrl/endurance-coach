import { useState } from 'react'
import type { Discipline } from '../../types'

interface StatInputProps {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number'
  optional?: boolean
}

function StatInput({ label, placeholder, value, onChange, type = 'text', optional }: StatInputProps) {
  return (
    <div>
      <label className="flex items-end h-8 text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
        {label}
        {optional && <span className="ml-1 normal-case font-normal text-gray-400">(opt)</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
      />
    </div>
  )
}

interface Props {
  disciplines: Discipline[]
  initialStats?: Record<string, string>
  initialCoachNote?: string
  onNext: (data: { stats: Record<string, string>; coachNote: string }) => void
  onBack: () => void
}

export default function OnboardingStep4({ disciplines, initialStats = {}, initialCoachNote = '', onNext, onBack }: Props) {
  const [stats, setStats]       = useState<Record<string, string>>(initialStats)
  const [coachNote, setCoachNote] = useState(initialCoachNote)

  function set(key: string, val: string) {
    setStats(s => ({ ...s, [key]: val }))
  }

  const hasRun  = disciplines.includes('run')
  const hasRide = disciplines.includes('ride')
  const hasSwim = disciplines.includes('swim')

  const hasVolumes = disciplines.every(d =>
    d === 'run'  ? (parseFloat(stats.run_weekly_km  ?? '') || 0) > 0
    : d === 'ride' ? (parseFloat(stats.ride_weekly_km ?? '') || 0) > 0
    : d === 'swim' ? (parseFloat(stats.swim_weekly_km ?? '') || 0) > 0
    : true
  )

  return (
    <div className="px-5 pb-8">
      {/* Progress — all 4 bars filled */}
      <div className="pt-6 mb-7">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Step 4 of 4</span>
        <div className="flex gap-1.5 mt-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex-1 h-0.5 rounded-full" style={{ backgroundColor: 'var(--volt)' }} />
          ))}
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-8 leading-snug">Your current fitness</h1>

      <div className="space-y-5 mb-8">
        {hasRun && (
          <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
            <p className="font-semibold text-sm mb-4 text-gray-800">🏃 Running</p>
            <div className="grid grid-cols-2 gap-3">
              <StatInput label="Weekly km" placeholder="e.g. 40"   value={stats.run_weekly_km  ?? ''} onChange={v => set('run_weekly_km', v)}  type="number" />
              <StatInput label="Easy pace" placeholder="e.g. 6:00" value={stats.run_pace       ?? ''} onChange={v => set('run_pace', v)}        optional />
            </div>
          </div>
        )}

        {hasRide && (
          <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
            <p className="font-semibold text-sm mb-4 text-gray-800">🚴 Cycling</p>
            <div className="grid grid-cols-2 gap-3">
              <StatInput label="Weekly km" placeholder="e.g. 150"  value={stats.ride_weekly_km ?? ''} onChange={v => set('ride_weekly_km', v)} type="number" />
              <StatInput label="Avg speed" placeholder="e.g. 28"   value={stats.ride_speed     ?? ''} onChange={v => set('ride_speed', v)}     type="number" optional />
            </div>
          </div>
        )}

        {hasSwim && (
          <div className="p-4 rounded-2xl border border-gray-200 bg-gray-50">
            <p className="font-semibold text-sm mb-4 text-gray-800">🏊 Swimming</p>
            <div className="grid grid-cols-2 gap-3">
              <StatInput label="Weekly km" placeholder="e.g. 5"    value={stats.swim_weekly_km     ?? ''} onChange={v => set('swim_weekly_km', v)}     type="number" />
              <StatInput label="100m pace" placeholder="e.g. 2:00" value={stats.swim_pace_per_100m ?? ''} onChange={v => set('swim_pace_per_100m', v)} optional />
            </div>
          </div>
        )}
      </div>

      {/* Coach notes */}
      <section className="mb-8">
        <h2 className="text-base font-semibold mb-1">
          Anything else your coach should know?{' '}
          <span className="font-normal text-gray-400">(optional)</span>
        </h2>
        <p className="text-gray-500 text-sm mb-3">Training preferences, injury history, session frequency…</p>
        <textarea
          rows={4}
          placeholder="e.g. I prefer not to train on Mondays. I have a slight knee issue. I want 3 swims and 3 runs per week."
          value={coachNote}
          onChange={e => setCoachNote(e.target.value)}
          className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
        />
      </section>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 border border-gray-200 font-semibold rounded-xl text-gray-700">
          Back
        </button>
        <button
          onClick={() => hasVolumes && onNext({ stats, coachNote })}
          disabled={!hasVolumes}
          className="flex-1 py-4 font-semibold rounded-xl disabled:opacity-40 text-base"
          style={{ backgroundColor: 'var(--volt)', color: 'var(--ink)' }}
        >
          Build my plan
        </button>
      </div>
    </div>
  )
}
