import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import type { CoachNote } from '../../types'
import { pillStyle } from '../notes/CoachNoteCard'

interface Props {
  note: CoachNote
}

export default function LatestCoachNote({ note }: Props) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  const dateRange = `${format(parseISO(note.week_start), 'MMM d')} – ${format(parseISO(note.week_end), 'MMM d')}`

  return (
    <div className="mx-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-base">Coach Notes</span>
        <button
          onClick={() => navigate('/notes')}
          className="text-sm text-gray-500 hover:text-black"
        >
          All notes &rsaquo;
        </button>
      </div>

      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="text-xs text-gray-400 font-medium mb-1 uppercase tracking-wide">
          Week {note.week_number} &middot; {dateRange}
        </div>
        <p className="text-sm text-gray-800 leading-relaxed">
          {note.headline}
        </p>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {note.metric_pills?.map(pill => (
                <span key={pill.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${pillStyle(pill.color)}`}>
                  {pill.label}
                </span>
              ))}
            </div>
            {note.swim_observations && <p className="text-sm text-gray-600 mb-1">{note.swim_observations}</p>}
            {note.ride_observations && <p className="text-sm text-gray-600 mb-1">{note.ride_observations}</p>}
            {note.run_observations && <p className="text-sm text-gray-600 mb-1">{note.run_observations}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
