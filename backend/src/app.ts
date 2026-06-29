import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { logger } from './lib/logger'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() })
})

// Domains — routers will be mounted here as they are implemented
// app.use('/auth', authRouter)
// app.use('/jobs', jobsRouter)
// app.use('/applications', applicationsRouter)
// app.use('/favorites', favoritesRouter)

// Global error handler — must be last
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } })
})

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

export { app }
