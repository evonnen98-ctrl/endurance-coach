import { useState } from 'react'
import { X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import type { User, Discipline, TrainingStyle } from '../../types'

interface Props {
  user: User
  onClose: () => void
}

const DISCIPLINES: Discipline[] = ['swim', 'ride', 'run']
const STYLES: TrainingStyle[] = ['conservative', 'moderate', 'aggressive']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function ProfileDrawer({ user, onClose }: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(user.name)
  const [disciplines, setDisciplines] = useState<Discipline[]>(user.disciplines)
  const [style, setStyle] = useState<TrainingStyle>(user.training_style)
  const [ftp, setFtp] = useState(user.ftp?.toString() ?? '')
  const [swimPref, setSwimPref] = useState(user.swim_pool_or_open ?? 'pool')
  const [injuryNotes, setInjuryNotes] = useState(user.injury_notes ?? '')
  const [coachNote, setCoachNote] = useState(user.coach_notes_freetext ?? '')
  const [saving, setSaving] = useState(false)

  const toggleDiscipline = (d: Discipline) => {
    setDisciplines(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  async function save() {
    setSaving(true)
    await supabase.from('users').update({
      name,
      disciplines,
      training_style: style,
      ftp: ftp ? parseInt(ftp) : null,
      swim_pool_or_open: swimPref,
      injury_notes: injuryNotes || null,
      coach_notes_freetext: coachNote || null,
      updated_at: new Date().toISOString(),
    }).eq('id', DEMO_USER_ID)
    await queryClient.invalidateQueries({ queryKey: ['user'] })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-xl">Profile & Settings</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="px-5 py-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-base"
            />
          </div>

          {/* Disciplines */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Disciplines</label>
            <div className="flex gap-2">
              {DISCIPLINES.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDiscipline(d)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                    disciplines.includes(d)
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Training style */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Training style</label>
            <div className="flex gap-2">
              {STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-medium capitalize transition-all ${
                    style === s ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* FTP */}
          {disciplines.includes('ride') && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
                FTP (watts)
              </label>
              <input
                type="number"
                value={ftp}
                onChange={e => setFtp(e.target.value)}
                placeholder="e.g. 240"
                className="w-full p-3 border border-gray-200 rounded-xl text-base"
              />
            </div>
          )}

          {/* Swim preference */}
          {disciplines.includes('swim') && (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Swim environment
              </label>
              <div className="flex gap-2">
                {['pool', 'open water'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setSwimPref(opt)}
                    className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-medium capitalize transition-all ${
                      swimPref === opt ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Injury history */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Injury history
            </label>
            <textarea
              rows={2}
              placeholder="Any recurring injuries or areas to watch…"
              value={injuryNotes}
              onChange={e => setInjuryNotes(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>

          {/* Coach notes */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">
              Notes for your coach
            </label>
            <textarea
              rows={3}
              placeholder="Preferences, constraints, anything else your coach should know…"
              value={coachNote}
              onChange={e => setCoachNote(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none"
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="w-full py-4 bg-black text-white font-semibold rounded-xl disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
