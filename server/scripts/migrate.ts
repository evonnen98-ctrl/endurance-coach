import 'dotenv/config'
import { runMigrations } from '../lib/migrate.js'

runMigrations().catch(console.error)
