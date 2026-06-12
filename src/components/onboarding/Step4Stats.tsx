import { useState } from 'react'
import type { Discipline } from '../../types'

interface Props {
  disciplines: Discipline[]
  onNext: (stats: Record<string, string>, coachNote: string) => void
  onBack: () => void
}

export default function Step4Stats({ disciplines, onNext, onBack }: Props) {
  const [stats, setStats] = useState<Record<string, string>>({})
  const [coachNote, setCoachNote] = useState('')

  const set = (key: string, val: string) => setStats(s => ({ ...s, [key]: val }))

  return (
    <div className="px-6 pb-8">
      <h1 className="text-3xl font-bold mt-2 mb-1">Let's build your plan</h1>
      <div className="flex gap-2 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex-1 h-0.5 bg-black" />
        ))}
      </div>

      <h2 className="text-xl font-semibold mb-1">Where you are today</h2>
      <p className="text-gray-500 text-sm mb-6">Rough numbers are fine. You can refine later.</p>

      <div className="space-y-4 mb-6">
        {disciplines.includes('run') && (
          <div className="p-4 rounded-xl border-2 border-green-100 bg-green-50/40">
            <div className="flex items-center gap-2 mb-4">
              <span>🏃</span>
              <span className="font-semibold text-green-700">Run</span>
            </div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Current weekly distance (km)
            </label>
            <input
              type="number"
              placeholder="35"
              value={stats.run_weekly_km ?? ''}
              onChange={e => set('run_weekly_km', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base mb-3"
            />
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Comfortable easy pace per km
            </label>
            <input
              type="text"
              placeholder="5:20"
              value={stats.run_pace ?? ''}
              onChange={e => set('run_pace', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
            />
          </div>
        )}

        {disciplines.includes('ride') && (
          <div className="p-4 rounded-xl border-2 border-orange-100 bg-orange-50/40">
            <div className="flex items-center gap-2 mb-4">
              <span>🚴</span>
              <span className="font-semibold text-orange-700">Ride</span>
            </div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Current weekly distance (km) or hours
            </label>
            <input
              type="text"
              placeholder="120"
              value={stats.ride_weekly_km ?? ''}
              onChange={e => set('ride_weekly_km', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base mb-3"
            />
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Average effort (Z2 power, perceived effort, or pace)
            </label>
            <input
              type="text"
              placeholder="60min @ 230w"
              value={stats.ride_effort ?? ''}
              onChange={e => set('ride_effort', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
            />
          </div>
        )}

        {disciplines.includes('swim') && (
          <div className="p-4 rounded-xl border-2 border-blue-100 bg-blue-50/40">
            <div className="flex items-center gap-2 mb-4">
              <span>🏊</span>
              <span className="font-semibold text-blue-700">Swim</span>
            </div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Weekly distance (km) or sessions
            </label>
            <input
              type="text"
              placeholder="6"
              value={stats.swim_weekly_km ?? ''}
              onChange={e => set('swim_weekly_km', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base mb-3"
            />
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Comfortable 100m pace
            </label>
            <input
              type="text"
              placeholder="1:45"
              value={stats.swim_pace ?? ''}
              onChange={e => set('swim_pace', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-base"
            />
          </div>
        )}
      </div>

      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
        Anything else your coach should know? (optional)
      </label>
      <textarea
        rows={3}
        placeholder="e.g. I like long sessions on weekends. Prefer not to swim Mondays. Weekday sessions need to be under 90 mins."
        value={coachNote}
        onChange={e => setCoachNote(e.target.value)}
        className="w-full p-3 border border-gray-200 rounded-xl text-base resize-none mb-4"
      />
      <p className="text-gray-400 text-xs mb-8">
        You can refine injury history, training days, and detailed settings in your profile after this.
      </p>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-4 border border-gray-200 font-semibold rounded-xl">
          Back
        </button>
        <button
          onClick={() => onNext(stats, coachNote)}
          className="flex-1 py-4 bg-black text-white font-semibold rounded-xl"
        >
          Build my plan
        </button>
      </div>
    </div>
  )
}
