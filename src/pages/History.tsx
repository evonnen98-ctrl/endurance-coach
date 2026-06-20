import { useState } from 'react'
import { format, parseISO, startOfWeek } from 'date-fns'
import { Send, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { Session, WorkoutLog } from '../types'
import { disciplineLabel } from '../lib/discipline'
import { api } from '../lib/api'

interface HistoryEntry {
  session: Session
  log?: WorkoutLog
}

interface WeekGroup {
  weekNumber: number
  weekLabel: string
  entries: HistoryEntry[]
}

const discLabelStyle: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--graphite-300)',
}

const sectionLabel: React.CSSProperties = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%',
  fontWeight: 700,
  fontSize: 9,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--graphite-300)',
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const { session, log } = entry
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [localCoachResp, setLocalCoachResp] = useState(log?.coach_response ?? '')

  const disc = session.discipline
  const date = format(parseISO(session.scheduled_date + 'T12:00:00'), 'EEE d MMM')

  async function sendNote(e: React.MouseEvent) {
    e.stopPropagation()
    if (!note.trim() || sending || !log) return
    setSending(true)
    await supabase.from('workout_logs').update({ user_note: note.trim() }).eq('id', log.id)
    try {
      const res = await api.postWorkout({
        userId: DEMO_USER_ID, workoutLogId: log.id,
        sessionId: log.session_id ?? undefined,
        rpe: log.rpe ?? 6, user_note: note.trim(),
        actual_distance_km: log.actual_distance_km ?? undefined,
        actual_duration_minutes: log.actual_duration_minutes ?? undefined,
      })
      setLocalCoachResp(res.coach_response)
      await supabase.from('workout_logs').update({ coach_response: res.coach_response }).eq('id', log.id)
    } catch {
      setLocalCoachResp("Thanks — I'll keep that in mind for your next sessions.")
    }
    setNote('')
    setSending(false)
    qc.invalidateQueries({ queryKey: ['history'] })
  }

  return (
    <div
      className="bg-white rounded-xl overflow-hidden cursor-pointer"
      style={{ border: '1px solid var(--graphite-300)' }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Discipline caps label replaces emoji */}
        <span style={{ ...discLabelStyle, width: 28, flexShrink: 0 }}>
          {disciplineLabel[disc] ?? 'REST'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-[14px] truncate" style={{ color: 'var(--ink)' }}>{session.title}</span>
            <span className="text-[11px] font-medium flex-shrink-0" style={{ color: 'var(--graphite-300)' }}>{date}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {log ? (
              <>
                {log.actual_distance_km && (
                  <span className="text-[12px] font-medium" style={{ color: 'var(--graphite-500)' }}>{log.actual_distance_km}km</span>
                )}
                {log.actual_duration_minutes && (
                  <span className="text-[12px] font-medium" style={{ color: 'var(--graphite-500)' }}>· {log.actual_duration_minutes}min</span>
                )}
                {log.rpe && (
                  <span className="text-[12px] font-medium" style={{ color: 'var(--graphite-300)' }}>· RPE {log.rpe}</span>
                )}
              </>
            ) : (
              <span style={{ ...discLabelStyle, fontSize: 9 }}>Completed</span>
            )}
          </div>
        </div>
        {expanded
          ? <ChevronUp size={14} style={{ color: 'var(--graphite-300)', flexShrink: 0 }} />
          : <ChevronDown size={14} style={{ color: 'var(--graphite-300)', flexShrink: 0 }} />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4 pt-3 space-y-3"
          style={{ borderTop: '1px solid var(--mist)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--mist)' }}>
              <p style={{ ...discLabelStyle, marginBottom: 4 }}>Planned</p>
              <p className="text-[13px] font-medium" style={{ color: 'var(--graphite-500)' }}>
                {session.distance_km ? `${session.distance_km}km` : '—'}
                {session.duration_minutes ? ` · ${session.duration_minutes}min` : ''}
              </p>
            </div>
            {log ? (
              <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--mist)' }}>
                <p style={{ ...discLabelStyle, marginBottom: 4 }}>Actual</p>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {log.actual_distance_km ? `${log.actual_distance_km}km` : '—'}
                  {log.actual_duration_minutes ? ` · ${log.actual_duration_minutes}min` : ''}
                  {log.rpe ? ` · RPE ${log.rpe}` : ''}
                </p>
              </div>
            ) : (
              <div className="rounded-lg px-3 py-2.5 flex items-center" style={{ backgroundColor: 'var(--mist)' }}>
                <span style={{ ...discLabelStyle, fontSize: 9 }}>Done</span>
              </div>
            )}
          </div>

          {log?.user_note && (
            <p className="text-[13px] font-medium italic rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--mist)', color: 'var(--graphite-500)' }}>
              "{log.user_note}"
            </p>
          )}

          {localCoachResp && (
            <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: 'var(--mist)' }}>
              <p style={{ ...discLabelStyle, marginBottom: 4 }}>Coach</p>
              <p className="text-[13px] font-medium leading-relaxed" style={{ color: 'var(--ink)' }}>{localCoachResp}</p>
            </div>
          )}

          {log?.injury_flag && (
            <p className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: '#DC2626' }}>
              <AlertTriangle size={13} />
              Injury flagged
            </p>
          )}

          {log && (
            <div className="pt-1">
              <p style={{ ...sectionLabel, marginBottom: 8 }}>
                {localCoachResp ? 'Add a note' : 'Tell your coach how it went'}
              </p>
              <div className="flex gap-2 items-end">
                <textarea
                  rows={2}
                  placeholder={localCoachResp ? 'Any updates...' : 'How did it feel?'}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 p-3 rounded-lg text-[13px] font-medium resize-none"
                  style={{ backgroundColor: 'var(--mist)', border: '1px solid var(--graphite-300)', color: 'var(--ink)' }}
                />
                <button
                  onClick={sendNote}
                  disabled={sending || !note.trim()}
                  className="p-3 rounded-full disabled:opacity-40 flex-shrink-0"
                  style={{ backgroundColor: 'var(--volt)', color: 'var(--ink)' }}
                >
                  {sending
                    ? <span className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin block" />
                    : <Send size={14} />
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function groupByWeek(entries: HistoryEntry[]): WeekGroup[] {
  const map = new Map<number, WeekGroup>()
  for (const entry of entries) {
    const wk = entry.session.week_number ?? 0
    if (!map.has(wk)) {
      const date    = parseISO(entry.session.scheduled_date + 'T12:00:00')
      const monDate = startOfWeek(date, { weekStartsOn: 1 })
      const label   = wk > 0
        ? `Week ${wk} · w/c ${format(monDate, 'd MMM')}`
        : `w/c ${format(monDate, 'd MMM')}`
      map.set(wk, { weekNumber: wk, weekLabel: label, entries: [] })
    }
    map.get(wk)!.entries.push(entry)
  }
  return Array.from(map.values()).sort((a, b) => b.weekNumber - a.weekNumber)
}

export default function HistoryPage() {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .eq('status', 'complete')
        .order('scheduled_date', { ascending: false })
        .limit(60)

      if (!sessions?.length) return []

      const sessionIds = sessions.map(s => s.id)
      const { data: logs } = await supabase
        .from('workout_logs')
        .select('*')
        .in('session_id', sessionIds)

      const logBySessionId = Object.fromEntries(
        (logs ?? []).map(l => [l.session_id, l])
      )

      return sessions.map(s => ({
        session: s as Session,
        log: logBySessionId[s.id] as WorkoutLog | undefined,
      })) as HistoryEntry[]
    },
  })

  const weeks = groupByWeek(entries)

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white px-5 pt-14 pb-4" style={{ borderBottom: '1px solid var(--mist)' }}>
        <h1 style={{
          fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 800,
          fontSize: 28, letterSpacing: '-0.01em', lineHeight: 0.9,
          textTransform: 'uppercase', color: 'var(--ink)',
        }}>
          History
        </h1>
        {entries.length > 0 && (
          <p className="text-[12px] font-medium mt-1" style={{ color: 'var(--graphite-500)' }}>
            {entries.length} sessions logged
          </p>
        )}
      </div>

      <div className="px-5 pt-4 pb-24">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--graphite-300)', borderTopColor: 'transparent' }} />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[72px] font-black leading-none" style={{
              fontFamily: '"Archivo", sans-serif', fontStretch: '125%', fontWeight: 900,
              color: 'var(--volt)', letterSpacing: '-0.02em',
            }}>0</p>
            <p style={{ ...sectionLabel, marginTop: 10 }}>Sessions logged</p>
            <p className="text-sm font-medium mt-2" style={{ color: 'var(--graphite-500)' }}>Mark a session complete to see it here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {weeks.map(week => (
              <div key={week.weekNumber}>
                <p className="mb-2" style={sectionLabel}>{week.weekLabel}</p>
                <div className="space-y-2">
                  {week.entries.map(entry => (
                    <HistoryCard key={entry.session.id} entry={entry} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
