import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from '../lib/supabase'
import type { CoachNote } from '../types'
import CoachNoteCard from '../components/notes/CoachNoteCard'

export default function NotesPage() {
  const { data: coachNotes = [] } = useQuery({
    queryKey: ['coach-notes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coach_notes')
        .select('*')
        .eq('user_id', DEMO_USER_ID)
        .order('week_number', { ascending: false })
      return (data ?? []) as CoachNote[]
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-12 pb-5">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Weekly reviews</div>
        <h1 className="text-3xl font-bold">Coach Notes</h1>
      </div>

      <div className="px-4 pt-5 space-y-4 pb-6">
        {coachNotes.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            Coach notes will appear here at the end of each week.
          </div>
        ) : (
          coachNotes.map((note, i) => (
            <CoachNoteCard key={note.id} note={note} defaultExpanded={i === 0} />
          ))
        )}
      </div>
    </div>
  )
}
