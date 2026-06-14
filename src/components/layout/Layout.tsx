import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { User } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import BottomNav from './BottomNav'
import ProfileDrawer from '../profile/ProfileDrawer'
import { supabase, DEMO_USER_ID } from '../../lib/supabase'
import type { User as UserType } from '../../types'

export default function Layout() {
  const [showProfile, setShowProfile] = useState(false)

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('*').eq('id', DEMO_USER_ID).single()
      return data as UserType | null
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed top header bar — same height/position on every page */}
      <header className="fixed top-0 left-0 right-0 h-12 bg-white z-40">
        <div className="max-w-[860px] mx-auto h-full flex items-center justify-end px-5">
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Profile & settings"
          >
            <User size={18} className="text-gray-500" />
          </button>
        </div>
      </header>

      <main className="pb-24 min-h-screen max-w-[860px] mx-auto">
        <Outlet />
      </main>
      <BottomNav />

      {showProfile && user && (
        <ProfileDrawer user={user} onClose={() => setShowProfile(false)} />
      )}
    </div>
  )
}
