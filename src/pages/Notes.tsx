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
      <div className="bg-white px-6 pt-14 pb-5">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Weekly reviews</div>
        <h1 className="text-2xl font-semibold">Coach Notes</h1>
      </div>

      <div className="px-6 pt-6 space-y-4 pb-6">
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
