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
  const { processWebhookJob, QUEUE_NAMES } = await import('@/jobs/webhook')
  const { getQueueConfigWithEnvOverrides } = await import('@/config/queues')

  // Register workers with per-queue configuration
  const webhookConfig = getQueueConfigWithEnvOverrides(QUEUE_NAMES.WEBHOOK)
  workerService.createWorker(QUEUE_NAMES.WEBHOOK, processWebhookJob, {
    concurrency: webhookConfig.concurrency,
  })

  logger.info('✅ All workers registered successfully')
  logger.info(`🔄 ${QUEUE_NAMES.WEBHOOK}: concurrency=${webhookConfig.concurrency}`)

  // =============================================
  // Setup Queue Event Handlers
  // =============================================
  // Event handlers process worker results and write to database
  // This is where business logic and DB updates happen
  setupQueueEventHandlers(container)

  // Add more workers here with their own configurations:
  // const videoConfig = getQueueConfigWithEnvOverrides('video-generation')
  // workerService.createWorker('video-generation', processVideoJob, {
  //   concurrency: videoConfig.concurrency,
  // })
}

/**
 * Setup queue event handlers for processing worker results
 *
 * Pattern: Worker returns data → Event handler writes to DB
 * This separates concerns and prevents race conditions
 */
async function setupQueueEventHandlers(container: Awaited<DIContainer>) {
  const webhookQueue = container.cradle.webhookQueue
  if (!webhookQueue) return

  const logger = new Logger('QueueEvents')

  // =============================================
  // Event Handlers: Process worker results
  // =============================================
  // Note: Use QueueEvents for reliable event handling in distributed systems
  // For simple setups, worker.on() events work fine (see worker.service.ts)

  logger.info('✅ Queue event handlers registered')
  logger.info('ℹ️  Job events are handled by WorkerService (see shared/queue/worker.service.ts)')

  // For custom business logic, add handlers here:
  // Example pattern (uncomment to use):
  //
  // const queueEvents = new QueueEvents('webhook-processor', { connection: redisConnection })
  //
  // queueEvents.on('completed', async ({ jobId, returnvalue }) => {
  //   logger.info(`Job ${jobId} completed`)
  //   // Save to DB, trigger next step, etc.
  // })
  //
  // queueEvents.on('failed', async ({ jobId, failedReason }) => {
  //   logger.error(`Job ${jobId} failed: ${failedReason}`)
  //   // Handle failure
  // })
}

// Start the server
startServer()
