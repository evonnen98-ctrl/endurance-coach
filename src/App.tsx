import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase, DEMO_USER_ID } from './lib/supabase'
import type { User } from './types'
import Layout from './components/layout/Layout'
import Today from './pages/Today'
import Plan from './pages/Plan'
import Progress from './pages/Progress'
import Coach from './pages/Coach'
import History from './pages/History'
import OnboardingFlow from './components/onboarding/OnboardingFlow'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const { data } = await supabase
        .from('users').select('*').eq('id', DEMO_USER_ID).single()
      return data as User | null
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !user.onboarding_complete) {
    return <OnboardingFlow existingUser={user ?? null} />
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today"    element={<Today />} />
          <Route path="plan"     element={<Plan />} />
          <Route path="progress" element={<Progress />} />
          <Route path="coach"    element={<Coach />} />
          <Route path="notes"    element={<Navigate to="/coach" replace />} />
          <Route path="history"  element={<History />} />
        </Route>
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
