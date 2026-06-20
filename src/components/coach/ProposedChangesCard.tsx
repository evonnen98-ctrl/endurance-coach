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

const archivoCaps: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const pillBtn: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  borderRadius: 999,
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
    <div className="mx-4 mt-2 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--mist)', border: '1px solid var(--graphite-300)' }}>
      <div className="px-4 pt-3 pb-2" style={{ borderBottom: '1px solid var(--graphite-300)' }}>
        <p style={{ ...archivoCaps, color: 'var(--graphite-500)' }}>Proposed plan changes</p>
      </div>

      <div className="px-4 py-3 space-y-3">
        {changes.map((c, i) => (
          <div key={i}>
            <p style={{ ...archivoCaps, color: 'var(--graphite-300)', marginBottom: 4 }}>{c.date}</p>
            <div className="flex items-start gap-2">
              <div className="flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--graphite-300)' }}>
                <p className="text-[13px] font-medium line-through" style={{ color: 'var(--graphite-300)' }}>{c.originalTitle}</p>
                {c.originalDuration > 0 && (
                  <p className="text-xs font-medium" style={{ color: 'var(--graphite-300)' }}>{c.originalDuration}min</p>
                )}
              </div>
              <span className="font-medium mt-2 flex-shrink-0" style={{ color: 'var(--graphite-300)', fontSize: 14 }}>→</span>
              <div className="flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--ink)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{c.newTitle}</p>
                {c.newDuration > 0 && (
                  <p className="text-xs font-medium" style={{ color: 'var(--graphite-500)' }}>{c.newDuration}min</p>
                )}
              </div>
            </div>
            {c.reason && (
              <p className="text-[12px] font-medium mt-1 leading-relaxed" style={{ color: 'var(--graphite-500)' }}>{c.reason}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={handleAccept}
          disabled={applying}
          className="flex-1 py-2.5 disabled:opacity-60"
          style={{ ...pillBtn, backgroundColor: 'var(--ink)', color: '#FFFFFF' }}
        >
          {applying ? 'Updating…' : 'Accept'}
        </button>
        <button
          onClick={onRejected}
          disabled={applying}
          className="flex-1 py-2.5"
          style={{ ...pillBtn, backgroundColor: 'transparent', color: 'var(--ink)', border: '1.5px solid var(--ink)' }}
        >
          Keep original
        </button>
      </div>
    </div>
  )
}
