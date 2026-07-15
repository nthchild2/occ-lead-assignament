import 'dotenv/config'
import express, { type Express } from 'express'
import cors from 'cors'
import { logger } from './lib/logger'
import { env } from './config/env'
import { errorMiddleware } from './middleware/error.middleware'
import { authRouter } from './domains/auth/auth.router'
import { jobsRouter } from './domains/jobs/jobs.router'
import * as jobsService from './domains/jobs/jobs.service'
import {
  createApplicationsActionsRouter,
  createApplicationsListRouter,
} from './domains/applications/applications.router'
import {
  createFavoritesActionsRouter,
  createFavoritesListRouter,
} from './domains/favorites/favorites.router'

const app: Express = express()
const PORT = env.PORT

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

// Domains — the composition root is the only place that wires the jobs lookup
// into the applications/favorites domains (A1 Decision 3): neither domain
// imports `domains/jobs` directly, both receive `getJob` via injection.
const getJob = jobsService.getById

app.use('/auth', authRouter)
app.use('/jobs', jobsRouter)
app.use('/jobs', createApplicationsActionsRouter({ getJob }))
app.use('/jobs', createFavoritesActionsRouter({ getJob }))
app.use('/applications', createApplicationsListRouter({ getJob }))
app.use('/favorites', createFavoritesListRouter({ getJob }))

// Global error handler — must be last
app.use(errorMiddleware)

// Skip binding a real port under Jest (NODE_ENV=test) so supertest can import
// `{ app }` without leaking an open server handle.
if (env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Server started on all interfaces')
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
