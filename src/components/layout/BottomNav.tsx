import { NavLink } from 'react-router-dom'
import { Home, Calendar, TrendingUp, MessageCircle, Clock } from 'lucide-react'

const tabs = [
  { to: '/today',    label: 'TODAY',    Icon: Home },
  { to: '/plan',     label: 'PLAN',     Icon: Calendar },
  { to: '/progress', label: 'PROGRESS', Icon: TrendingUp },
  { to: '/coach',    label: 'COACH',    Icon: MessageCircle },
  { to: '/history',  label: 'HISTORY',  Icon: Clock },
]

const labelStyle = {
  fontFamily: '"Archivo", sans-serif',
  fontStretch: '125%' as const,
  fontWeight: 700,
  fontSize: 8,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
}

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 safe-bottom z-40 bg-ink">
      <div className="max-w-[860px] mx-auto flex">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center gap-1 pt-2 pb-3 relative transition-colors"
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2"
                    style={{ width: 28, height: 2, backgroundColor: 'var(--volt)' }}
                  />
                )}
                <Icon
                  size={19}
                  strokeWidth={isActive ? 2 : 1.5}
                  style={{ color: isActive ? 'var(--volt)' : 'var(--graphite-500)' }}
                />
                <span style={{ ...labelStyle, color: isActive ? 'var(--volt)' : 'var(--graphite-500)' }}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
