import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pb-24 min-h-screen max-w-[900px] mx-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
