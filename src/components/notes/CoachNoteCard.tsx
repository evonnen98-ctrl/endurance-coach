import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoachNote, MetricPill } from '../../types'

const archivoCaps: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
}

export function pillStyle(color: MetricPill['color']) {
  if (color === 'grey') return 'text-xs font-medium px-2.5 py-1 rounded-full'
  return 'text-xs font-semibold px-2.5 py-1 rounded-full'
}

export function pillInlineStyle(color: MetricPill['color']): React.CSSProperties {
  if (color === 'grey') return {
    backgroundColor: 'var(--mist)',
    color: 'var(--graphite-500)',
    border: '1px solid var(--graphite-300)',
  }
  return {
    backgroundColor: 'var(--ink)',
    color: '#FFFFFF',
  }
}

interface Props {
  note: CoachNote
  defaultExpanded?: boolean
}

export default function CoachNoteCard({ note, defaultExpanded = false }: Props) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [reply, setReply] = useState(note.user_reply ?? '')
  const [sending, setSending] = useState(false)

  const weekStart = format(parseISO(note.week_start), 'MMM d')
  const weekEnd   = format(parseISO(note.week_end),   'MMM d')

  async function sendReply() {
    if (!reply.trim()) return
    setSending(true)
    await supabase
      .from('coach_notes')
      .update({ user_reply: reply, user_reply_at: new Date().toISOString() })
      .eq('id', note.id)
    await queryClient.invalidateQueries({ queryKey: ['coach-notes'] })
    setSending(false)
  }

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid var(--graphite-300)' }}>
      {/* Collapsed header */}
      <button
        className="w-full text-left px-5 py-4"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span style={{ ...archivoCaps, color: 'var(--graphite-300)' }}>
              Week {note.week_number}
            </span>
            <span style={{ color: 'var(--graphite-300)', fontSize: 11 }}>·</span>
            <span style={{ ...archivoCaps, color: 'var(--graphite-300)', fontWeight: 500 }}>
              {weekStart} – {weekEnd}
            </span>
          </div>
          {expanded
            ? <ChevronUp size={16} style={{ color: 'var(--graphite-300)', flexShrink: 0 }} />
            : <ChevronDown size={16} style={{ color: 'var(--graphite-300)', flexShrink: 0 }} />}
        </div>

        {note.metric_pills && note.metric_pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {note.metric_pills.map(pill => (
              <span
                key={pill.label}
                className={pillStyle(pill.color)}
                style={pillInlineStyle(pill.color)}
              >
                {pill.label}
              </span>
            ))}
          </div>
        )}

        {note.headline && (
          <p className={`text-sm font-medium leading-relaxed ${expanded ? '' : 'line-clamp-2'}`} style={{ color: 'var(--ink)' }}>
            {note.headline}
          </p>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--mist)' }} className="px-5 pb-5 pt-4 space-y-5">
          {(note.swim_observations || note.ride_observations || note.run_observations) && (
            <div className="space-y-3">
              {note.swim_observations && (
                <div className="flex gap-3">
                  <div className="w-px rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--graphite-300)' }} />
                  <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{note.swim_observations}</p>
                </div>
              )}
              {note.ride_observations && (
                <div className="flex gap-3">
                  <div className="w-px rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--graphite-300)' }} />
                  <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{note.ride_observations}</p>
                </div>
              )}
              {note.run_observations && (
                <div className="flex gap-3">
                  <div className="w-px rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--graphite-300)' }} />
                  <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{note.run_observations}</p>
                </div>
              )}
            </div>
          )}

          {note.recovery_assessment && (
            <div>
              <p style={{ ...archivoCaps, color: 'var(--graphite-300)', marginBottom: 6 }}>Recovery</p>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{note.recovery_assessment}</p>
            </div>
          )}

          {note.looking_ahead && (
            <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--mist)' }}>
              <p style={{ ...archivoCaps, color: 'var(--graphite-300)', marginBottom: 6 }}>Looking ahead</p>
              <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{note.looking_ahead}</p>
            </div>
          )}

          {note.closing_prompt && (
            <div style={{ borderTop: '1px solid var(--mist)', paddingTop: 16 }}>
              <p className="text-sm font-medium leading-relaxed mb-3" style={{ color: 'var(--ink)' }}>
                <span className="font-semibold">Coach: </span>{note.closing_prompt}
              </p>
              {note.user_reply ? (
                <div className="rounded-lg px-4 py-3 text-sm font-medium" style={{ backgroundColor: 'var(--mist)', color: 'var(--ink)' }}>
                  {note.user_reply}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Reply to your coach…"
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendReply()}
                    className="flex-1 px-3 py-2.5 text-sm font-medium rounded-lg outline-none"
                    style={{ border: '1px solid var(--graphite-300)', color: 'var(--ink)', backgroundColor: '#FFFFFF' }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="px-3 py-2.5 rounded-full disabled:opacity-40 flex items-center"
                    style={{ backgroundColor: 'var(--volt)', color: 'var(--ink)' }}
                  >
                    {sending
                      ? <span className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                      : <Send size={14} />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
