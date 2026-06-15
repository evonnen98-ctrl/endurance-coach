import { useState } from 'react'
import { format, parseISO, startOfWeek, addDays } from 'date-fns'
import { Send } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { Session, WorkoutLog } from '../types'
import { disciplineColor, disciplineLabel } from '../lib/discipline'
import { api } from '../lib/api'

const EMOJI: Record<string, string> = {
  swim: '🏊', ride: '🚴', run: '🏃', brick: '🏊', rest: '😴',
}

interface HistoryEntry {
  session: Session
  log?: WorkoutLog
}

interface WeekGroup {
  weekNumber: number
  weekLabel: string
  entries: HistoryEntry[]
}

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  const { session, log } = entry
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [localCoachResp, setLocalCoachResp] = useState(log?.coach_response ?? '')

  const disc  = session.discipline
  const color = disciplineColor[disc] ?? '#9CA3AF'
  const emoji = EMOJI[disc] ?? '🏃'
  const date  = format(parseISO(session.scheduled_date + 'T12:00:00'), 'EEE d MMM')

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
      className="bg-white rounded-lg overflow-hidden cursor-pointer"
      style={{ border: '1px solid #F3F4F6', borderLeft: `3px solid ${color}` }}
      onClick={() => setExpanded(e => !e)}
    >
      {/* Compact collapsed row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-lg leading-none flex-shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold text-[14px] text-gray-900 truncate">{session.title}</span>
            <span className="text-[11px] text-gray-400 flex-shrink-0">{date}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {log ? (
              <>
                {log.actual_distance_km && (
                  <span className="text-[12px] text-gray-500">{log.actual_distance_km}km</span>
                )}
                {log.actual_duration_minutes && (
                  <span className="text-[12px] text-gray-500">· {log.actual_duration_minutes}min</span>
                )}
                {log.rpe && (
                  <span className="text-[12px] text-gray-400">· RPE {log.rpe}</span>
                )}
              </>
            ) : (
              <span className="text-[12px] text-green-600 font-medium">✓ Completed</span>
            )}
          </div>
        </div>
        <span className="text-[11px] text-gray-300 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3"
          onClick={e => e.stopPropagation()}
        >
          {/* Planned vs Actual */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Planned</p>
              <p className="text-[13px] text-gray-700">
                {session.distance_km ? `${session.distance_km}km` : '—'}
                {session.duration_minutes ? ` · ${session.duration_minutes}min` : ''}
              </p>
            </div>
            {log ? (
              <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: `${color}10` }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color }}>Actual</p>
                <p className="text-[13px] font-medium text-gray-900">
                  {log.actual_distance_km ? `${log.actual_distance_km}km` : '—'}
                  {log.actual_duration_minutes ? ` · ${log.actual_duration_minutes}min` : ''}
                  {log.rpe ? ` · RPE ${log.rpe}` : ''}
                </p>
              </div>
            ) : (
              <div className="bg-green-50 rounded-lg px-3 py-2.5 flex items-center">
                <span className="text-[13px] text-green-700 font-medium">✓ Done</span>
              </div>
            )}
          </div>

          {log?.user_note && (
            <p className="text-[13px] text-gray-700 italic bg-gray-50 rounded-lg px-3 py-2.5">
              "{log.user_note}"
            </p>
          )}

          {localCoachResp && (
            <div className="bg-stone-50 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Coach</p>
              <p className="text-[13px] text-gray-700 leading-relaxed">{localCoachResp}</p>
            </div>
          )}

          {log?.injury_flag && (
            <p className="text-[12px] text-red-600 font-medium">⚠️ Injury flagged</p>
          )}

          {log && (
            <div className="pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                {localCoachResp ? 'Add a note' : 'Tell your coach how it went'}
              </p>
              <div className="flex gap-2 items-end">
                <textarea
                  rows={2}
                  placeholder={localCoachResp ? 'Any updates...' : 'How did it feel?'}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-[13px] placeholder-gray-400 resize-none"
                />
                <button
                  onClick={sendNote}
                  disabled={sending || !note.trim()}
                  className="p-3 bg-gray-900 text-white rounded-lg disabled:opacity-40 flex-shrink-0"
                >
                  {sending
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
                    : <Send size={15} />
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-14 pb-4">
        <h1 className="text-[22px] font-semibold" style={{ color: '#1C1917' }}>History</h1>
        {entries.length > 0 && (
          <p className="text-[13px] text-gray-400 mt-0.5">{entries.length} sessions logged</p>
        )}
      </div>

      <div className="px-5 pt-4 pb-24">
        {isLoading ? (
          <div className="text-center py-16 text-[13px] text-gray-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-gray-400">No workouts logged yet.</p>
            <p className="text-[13px] text-gray-300 mt-1">Mark a session complete to see it here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {weeks.map(week => (
              <div key={week.weekNumber}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  {week.weekLabel}
                </p>
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
