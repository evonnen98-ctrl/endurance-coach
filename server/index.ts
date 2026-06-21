import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import aiRouter from './routes/ai.js'
import onboardingRouter from './routes/onboarding.js'
import { runMigrations } from './lib/migrate.js'

const app = express()
const PORT = process.env.PORT ?? 3002
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '../dist')

// Allow localhost in dev; in prod the frontend is same-origin so CORS isn't needed
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }))
app.use(express.json())

app.use('/api/ai', aiRouter)
app.use('/api/onboarding', onboardingRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve the Vite build whenever dist/ exists (production and any local build)
if (existsSync(distPath)) {
  // Hashed assets (/assets/*.js, /assets/*.css) — safe to cache forever
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }))

  // version.json — fetched by the running bundle to detect stale deploys; must never be cached
  app.get('/version.json', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(path.join(distPath, 'version.json'))
  })

  // Public folder (images, favicon, etc.) — moderate cache, no immutable
  app.use(express.static(distPath, { index: false, maxAge: '1h' }))

  // index.html — must never be cached; stale HTML points to old hashed bundles
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`)
  })
})
