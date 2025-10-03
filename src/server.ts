// IMPORTANT: Load environment variables FIRST before any imports
// This ensures Config validation uses the correct values
import dotenv from 'dotenv'
import * as path from 'path'

if (process.env.NODE_ENV === 'test' && process.env.USE_ENV_FILE) {
  // Load .env.test for E2E tests
  const envTestPath = path.resolve(__dirname, '../.env.test')
  dotenv.config({ path: envTestPath })
  // eslint-disable-next-line no-console
  console.log('📝 Loaded test environment from .env.test')
} else if (process.env.NODE_ENV !== 'test') {
  // Load .env for dev/prod, but don't override existing vars
  dotenv.config({ override: false })
}
// For unit tests - don't load any .env file (use mocks)

// NOW import modules (after env is loaded)
import { createApp } from '@/app'
import { Logger } from '@/shared/utils/logger'
import { Config } from '@/config'
import { setupShutdownHandlers } from '@/shared/utils/graceful-shutdown'
import { setupProcessErrorHandlers } from '@/shared/utils/process-handlers'
import type { DIContainer } from '@/container'

const logger = new Logger('Server')

/**
 * Start server function
 * Clean, focused, single responsibility
 *
 * Supports different modes:
 * - MODE=api: API server only (no workers)
 * - MODE=all: API server + Workers (single process)
 * - MODE=worker: Workers only (use worker.ts instead)
 */
async function startServer() {
  try {
    logger.info('🚀 Starting server initialization...')
    logger.info(`Environment: ${Config.NODE_ENV}`)
    logger.info(`Service: ${Config.SERVICE_NAME} v${Config.SERVICE_VERSION}`)
    logger.info(`Mode: ${Config.MODE}`)

    // Create app context (no global state!)
    const { fastify, container } = await createApp()

    // If MODE=all, start workers in the same process
    if (Config.MODE === 'all') {
      logger.info('Starting workers (MODE=all)...')
      await startWorkers(container)
    }

    // Setup shutdown handlers BEFORE starting the server
    setupShutdownHandlers({ fastify, container })
    setupProcessErrorHandlers({ fastify, container })

    // Start listening
    const address = await fastify.listen({
      port: Config.PORT,
      host: Config.HOST || '0.0.0.0',
    })

    logger.info(`✅ Server running on ${address}`)

    if (Config.ENABLE_SWAGGER) {
      logger.info(`📚 Swagger docs: ${address}/docs`)
    }

    // Check database connection
    try {
      const prisma = container.cradle.prisma
      if (prisma && typeof prisma.$queryRaw === 'function') {
        await prisma.$queryRaw`SELECT 1`
        logger.info('=== Database Status ===')
        logger.info('  PostgreSQL: ✅ Connected')
        logger.info('=======================')
      }
    } catch (error) {
      logger.warn('⚠️  Database connection check failed:', error)
    }

    // Print routes in development
    if (Config.NODE_ENV === 'development') {
      logger.info('\n=== Registered Routes ===')
      logger.info(fastify.printRoutes())
      logger.info('==========================\n')
    }

    logger.info('✅ Server started successfully')
  } catch (error) {
    logger.error('❌ Failed to start server', error)
    process.exit(1)
  }
}

/**
 * Start workers (only when MODE=all)
 * Registers worker processors for all queues
 */
async function startWorkers(container: Awaited<DIContainer>) {
  const workerService = container.cradle.workerService

  if (!workerService) {
    logger.warn('⚠️  Worker service not available - skipping worker initialization')
    return
  }

  logger.info('Registering workers...')

  // Import worker processors
  const { processWebhookJob } = await import('@/modules/jobs/webhook-processor.worker')
  const { QUEUE_NAMES } = await import('@/modules/jobs/webhook-processor.queue')

  // Register workers
  workerService.createWorker(QUEUE_NAMES.WEBHOOK_PROCESSOR, processWebhookJob, {
    concurrency: Config.QUEUE_CONCURRENCY,
  })

  logger.info('✅ All workers registered successfully')
  logger.info(`🔄 Processing jobs with concurrency: ${Config.QUEUE_CONCURRENCY}`)
}

// Start the server
startServer()
