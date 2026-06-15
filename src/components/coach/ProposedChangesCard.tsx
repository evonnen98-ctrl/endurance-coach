import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ProposedChange } from '../../lib/api'
import { DEMO_USER_ID } from '../../lib/supabase'

interface Props {
  changes: ProposedChange[]
  onAccepted: () => void
  onRejected: () => void
}

export default function ProposedChangesCard({ changes, onAccepted, onRejected }: Props) {
  const queryClient = useQueryClient()
  const [applying, setApplying] = useState(false)

  async function handleAccept() {
    setApplying(true)
    try {
      await api.applyPlanChanges({ userId: DEMO_USER_ID, changes })
      await queryClient.invalidateQueries({ queryKey: ['all-sessions'] })
      await queryClient.invalidateQueries({ queryKey: ['today-session'] })
      await queryClient.invalidateQueries({ queryKey: ['week-sessions'] })
      onAccepted()
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mx-6 mt-2 bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-amber-100">
        <p className="text-[13px] font-semibold text-amber-800">Proposed plan changes</p>
      </div>

      {/* Changes list */}
      <div className="px-4 py-3 space-y-3">
        {changes.map((c, i) => (
          <div key={i}>
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">{c.date}</p>
            <div className="flex items-start gap-2">
              {/* Before */}
              <div className="flex-1 bg-white/60 rounded-lg px-3 py-2">
                <p className="text-[13px] text-gray-400 line-through">{c.originalTitle}</p>
                {c.originalDuration > 0 && (
                  <p className="text-xs text-gray-400">{c.originalDuration}min</p>
                )}
              </div>
              <span className="text-amber-400 mt-2 flex-shrink-0">→</span>
              {/* After */}
              <div className="flex-1 bg-white rounded-lg px-3 py-2 border border-amber-200">
                <p className="text-[13px] text-gray-800 font-medium">{c.newTitle}</p>
                {c.newDuration > 0 && (
                  <p className="text-xs text-gray-500">{c.newDuration}min</p>
                )}
              </div>
            </div>
            {c.reason && (
              <p className="text-[12px] text-amber-700 mt-1 leading-relaxed">{c.reason}</p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={handleAccept}
          disabled={applying}
          className="flex-1 py-2.5 bg-amber-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60"
        >
          {applying ? 'Updating…' : 'Accept changes'}
        </button>
        <button
          onClick={onRejected}
          disabled={applying}
          className="flex-1 py-2.5 border border-amber-300 text-amber-800 text-sm font-semibold rounded-xl"
        >
          Keep original
        </button>
      </div>
    </div>
  )
}
