import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoachNote, MetricPill } from '../../types'

export function pillStyle(color: MetricPill['color']) {
  const map: Record<MetricPill['color'], string> = {
    blue:   'bg-blue-50 text-blue-700 border border-blue-100',
    green:  'bg-green-50 text-green-700 border border-green-100',
    orange: 'bg-orange-50 text-orange-700 border border-orange-100',
    yellow: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
    grey:   'bg-gray-100 text-gray-600 border border-gray-200',
  }
  return map[color] ?? 'bg-gray-100 text-gray-600 border border-gray-200'
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
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">

      {/* ── Collapsed header (always visible) ── */}
      <button
        className="w-full text-left px-5 py-4"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Row 1: week label + date + chevron */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              Week {note.week_number}
            </span>
            <span className="text-gray-200">·</span>
            <span className="text-[11px] text-gray-400">{weekStart} – {weekEnd}</span>
          </div>
          {expanded
            ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
            : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
        </div>

        {/* Row 2: metric pills */}
        {note.metric_pills && note.metric_pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {note.metric_pills.map(pill => (
              <span
                key={pill.label}
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${pillStyle(pill.color)}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        )}

        {/* Row 3: headline */}
        {note.headline && (
          <p className={`text-sm text-gray-800 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
            {note.headline}
          </p>
        )}
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="border-t border-gray-50 px-5 pb-5 pt-4 space-y-5">

          {/* Discipline observations */}
          {(note.swim_observations || note.ride_observations || note.run_observations) && (
            <div className="space-y-3">
              {note.swim_observations && (
                <div className="flex gap-3">
                  <div className="w-0.5 bg-blue-200 rounded-full flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{note.swim_observations}</p>
                </div>
              )}
              {note.ride_observations && (
                <div className="flex gap-3">
                  <div className="w-0.5 bg-orange-200 rounded-full flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{note.ride_observations}</p>
                </div>
              )}
              {note.run_observations && (
                <div className="flex gap-3">
                  <div className="w-0.5 bg-green-200 rounded-full flex-shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{note.run_observations}</p>
                </div>
              )}
            </div>
          )}

          {/* Recovery */}
          {note.recovery_assessment && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Recovery</p>
              <p className="text-sm text-gray-700 leading-relaxed">{note.recovery_assessment}</p>
            </div>
          )}

          {/* Looking ahead */}
          {note.looking_ahead && (
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Looking ahead</p>
              <p className="text-sm text-gray-700 leading-relaxed">{note.looking_ahead}</p>
            </div>
          )}

          {/* Coach prompt + reply */}
          {note.closing_prompt && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-800 leading-relaxed mb-3">
                <span className="font-semibold">Coach: </span>{note.closing_prompt}
              </p>
              {note.user_reply ? (
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">
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
                    className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400"
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="px-3 py-2.5 bg-black text-white rounded-lg disabled:opacity-40 flex items-center"
                  >
                    {sending
                      ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
