import 'dotenv/config'
import express, { type Express } from 'express'
import cors from 'cors'
import { logger } from './lib/logger'
import { env } from './config/env'
import { errorMiddleware } from './middleware/error.middleware'
import { authRouter } from './domains/auth/auth.router'
import { jobsRouter } from './domains/jobs/jobs.router'

const app: Express = express()
const PORT = env.PORT

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

// Domains — routers will be mounted here as they are implemented
app.use('/auth', authRouter)
app.use('/jobs', jobsRouter)
// app.use('/applications', applicationsRouter)
// app.use('/favorites', favoritesRouter)

// Global error handler — must be last
app.use(errorMiddleware)

// Skip binding a real port under Jest (NODE_ENV=test) so supertest can import
// `{ app }` without leaking an open server handle.
if (env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server started')
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down')
    server.close(() => {
      logger.info('Server closed')
      process.exit(0)
    })
  })
}

export { app }
