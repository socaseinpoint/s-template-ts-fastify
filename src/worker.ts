// IMPORTANT: Load environment variables FIRST before any imports
import dotenv from 'dotenv'
import * as path from 'path'

if (process.env.NODE_ENV === 'test' && process.env.USE_ENV_FILE) {
  const envTestPath = path.resolve(__dirname, '../.env.test')
  dotenv.config({ path: envTestPath })
  // eslint-disable-next-line no-console
  console.log('📝 Loaded test environment from .env.test')
} else if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ override: false })
}

// NOW import modules (after env is loaded)
import { Logger } from '@/shared/utils/logger'
import { Config } from '@/config'
import { createRedisConnection, closeRedisConnection } from '@/shared/queue/redis-connection'
import { WorkerService } from '@/shared/queue/worker.service'
import { processWebhookJob, QUEUE_NAMES } from '@/jobs/webhook'
import { getQueueConfigWithEnvOverrides } from '@/config/queues'

const logger = new Logger('Worker')

/**
 * Worker Entry Point
 *
 * =============================================================================
 * WORKER ROLE: Process jobs by calling external APIs (Replicate, OpenAI, etc.)
 * =============================================================================
 *
 * What Worker Does:
 * -----------------
 * ✅ Make HTTP calls to external APIs (Replicate, OpenAI, Stripe, etc.)
 * ✅ Return result data to BullMQ
 * ✅ Retry on failure (automatic via BullMQ)
 * ✅ Run in parallel (multiple worker instances)
 *
 * What Worker Does NOT Do:
 * ------------------------
 * ❌ Write to database (use event handlers in API instead)
 * ❌ Complex business logic (keep in API/services)
 * ❌ Direct user communication (API handles this)
 * ❌ Trigger next pipeline steps (API orchestrates via events)
 *
 * Why This Separation?
 * --------------------
 * 1. Avoid race conditions (only API writes to DB)
 * 2. Lightweight workers (no DB connections = fast & scalable)
 * 3. Clear responsibility (worker = external calls, API = state management)
 * 4. Easy debugging (single source of truth for DB writes)
 *
 * Database Access Pattern:
 * ------------------------
 * Worker returns result → API event handler writes to DB
 *
 * Example:
 *   // Worker (NO DB)
 *   return { predictionId: 'abc123', output: '...' }
 *
 *   // API event handler (writes to DB)
 *   queue.on('completed', async (job, result) => {
 *     await prisma.update({ data: result })
 *   })
 *
 * See: docs/ARCHITECTURE_PRINCIPLES.md for detailed explanation
 *
 * Usage:
 *   MODE=worker npm run dev:worker   # Development
 *   MODE=worker npm start:worker     # Production
 */

let redisConnection: ReturnType<typeof createRedisConnection> | undefined
let workerService: WorkerService | undefined

async function startWorker() {
  try {
    logger.info('🚀 Starting worker initialization...')
    logger.info(`Environment: ${Config.NODE_ENV}`)
    logger.info(`Service: ${Config.SERVICE_NAME} v${Config.SERVICE_VERSION}`)
    logger.info(`Mode: ${Config.MODE}`)

    // Validate MODE
    if (Config.MODE !== 'worker' && Config.MODE !== 'all') {
      logger.warn(
        `⚠️  Worker started with MODE=${Config.MODE}. Use MODE=worker for worker-only or MODE=all for API+Worker`
      )
    }

    // Create Redis connection for BullMQ
    redisConnection = createRedisConnection()

    // Wait for Redis to be ready
    const REDIS_TIMEOUT = Config.QUEUE_CONCURRENCY * 2000 || 10000
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Redis connection timeout after ${REDIS_TIMEOUT}ms`))
      }, REDIS_TIMEOUT)

      redisConnection!.once('ready', () => {
        clearTimeout(timeout)
        logger.info('✅ Redis connected successfully')
        resolve()
      })

      redisConnection!.once('error', (error: Error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    // Create worker service (no DI - workers are dumb HTTP callers)
    workerService = new WorkerService(redisConnection)

    // Register workers for each queue with per-queue configuration
    logger.info('Registering workers...')

    // Webhook processor worker
    const webhookConfig = getQueueConfigWithEnvOverrides(QUEUE_NAMES.WEBHOOK)
    workerService.createWorker(QUEUE_NAMES.WEBHOOK, processWebhookJob, {
      concurrency: webhookConfig.concurrency,
    })
    logger.info(`📋 ${QUEUE_NAMES.WEBHOOK}: concurrency=${webhookConfig.concurrency}`)

    // Add more workers here with their own configurations:
    // const videoConfig = getQueueConfigWithEnvOverrides('video-generation')
    // workerService.createWorker('video-generation', processVideoJob, {
    //   concurrency: videoConfig.concurrency,
    //   removeOnComplete: videoConfig.removeOnComplete,
    //   removeOnFail: videoConfig.removeOnFail,
    // })
    // logger.info(`📋 video-generation: concurrency=${videoConfig.concurrency}`)

    logger.info('✅ All workers registered successfully')

    // Setup graceful shutdown
    setupShutdownHandlers()

    logger.info('✅ Worker started successfully')
  } catch (error) {
    logger.error('❌ Failed to start worker', error)
    process.exit(1)
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers() {
  const SHUTDOWN_TIMEOUT = 30000 // 30 seconds

  const shutdown = async (signal: string) => {
    logger.info(`\n${signal} received, starting graceful shutdown...`)

    // Set hard timeout for shutdown
    const forceExitTimeout = setTimeout(() => {
      logger.error('❌ Graceful shutdown timeout - forcing exit')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT)

    try {
      // 1. Stop accepting new jobs (close workers)
      if (workerService) {
        logger.info('Closing workers...')
        await workerService.close()
        logger.info('✅ Workers closed')
      }

      // 2. Close Redis connection (BullMQ)
      if (redisConnection) {
        logger.info('Closing Redis connection...')
        await closeRedisConnection(redisConnection)
        logger.info('✅ Redis connection closed')
      }

      clearTimeout(forceExitTimeout)
      logger.info('✅ Graceful shutdown completed')
      process.exit(0)
    } catch (error) {
      clearTimeout(forceExitTimeout)
      logger.error('❌ Error during shutdown', error)
      process.exit(1)
    }
  }

  // Handle shutdown signals
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  // Handle uncaught errors
  process.on('uncaughtException', (error: Error) => {
    logger.error('❌ Uncaught Exception', error)
    void shutdown('UNCAUGHT_EXCEPTION')
  })

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('❌ Unhandled Rejection', reason)
    void shutdown('UNHANDLED_REJECTION')
  })
}

// Start the worker
startWorker()
