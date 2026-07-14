import 'dotenv/config'
import app from '../server/app.js'

// Vercel serverless entry point. vercel.json rewrites all /api/* requests
// here; the Express app's own /api/ai and /api/onboarding routers still
// match on req.url, which the rewrite leaves intact.
//
// Deliberately does NOT run server/lib/migrate.ts on cold start (that would
// re-run on every cold start). Run `npm run migrate` against DATABASE_URL
// instead, before or after deploying.
export default app
