import { NavLink } from 'react-router-dom'
import { Home, Calendar, TrendingUp, FileText, Clock } from 'lucide-react'
import clsx from 'clsx'

const tabs = [
  { to: '/today', label: 'TODAY', Icon: Home },
  { to: '/plan', label: 'PLAN', Icon: Calendar },
  { to: '/progress', label: 'PROGRESS', Icon: TrendingUp },
  { to: '/notes', label: 'NOTES', Icon: FileText },
  { to: '/history', label: 'HISTORY', Icon: Clock },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-40">
      <div className="flex">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium tracking-widest transition-colors',
                isActive ? 'text-black' : 'text-gray-400'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
