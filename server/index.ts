import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import aiRouter from './routes/ai.js'

const app = express()
const PORT = process.env.PORT ?? 3002
const IS_PROD = process.env.NODE_ENV === 'production'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// In dev, restrict to localhost origins. In prod, frontend is same-origin so CORS is a no-op.
app.use(cors({ origin: IS_PROD ? false : /^http:\/\/localhost:\d+$/ }))
app.use(express.json())

app.use('/api/ai', aiRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Serve Vite build in production
if (IS_PROD) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  // All non-API routes return index.html so React Router handles them
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
