import express from 'express'
import cors from 'cors'
import aiRouter from './routes/ai.js'
import onboardingRouter from './routes/onboarding.js'

// Shared Express app — mounted by server/index.ts for local/always-on dev
// and by api/index.ts for Vercel's serverless runtime. Keep this file free of
// anything that assumes a long-lived process (no app.listen, no static/dist
// serving, no boot-time migrations).
const app = express()

// Allow localhost in dev; in prod the frontend is same-origin so CORS isn't needed
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }))
app.use(express.json())

app.use('/api/ai', aiRouter)
app.use('/api/onboarding', onboardingRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
