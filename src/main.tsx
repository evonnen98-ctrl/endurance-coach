import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { checkVersion } from './lib/versionCheck'

// Wake Railway container immediately so it's warm by the time plan generation runs
fetch('/api/health').catch(() => {})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

// Register service worker — network-first navigation means the fresh HTML is always
// served before React renders anything, so the stale iOS standalone cache never shows.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

// Version-check runs before React mounts as a secondary safety net for environments
// where the SW can't intercept (e.g. iOS < 16.4 in standalone mode).
// If the bundle is stale, checkVersion() calls location.reload() and the render
// below never executes.
;(async () => {
  await checkVersion()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
})()
