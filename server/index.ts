import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import aiRouter from './routes/ai.js'
import { runMigrations } from './lib/migrate.js'

const app = express()
const PORT = process.env.PORT ?? 3002
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '../dist')

// Allow localhost in dev; in prod the frontend is same-origin so CORS isn't needed
app.use(cors({ origin: /^http:\/\/localhost:\d+$/ }))
app.use(express.json())

app.use('/api/ai', aiRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve the Vite build whenever dist/ exists (production and any local build)
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`)
  })
})
