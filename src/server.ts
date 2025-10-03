// IMPORTANT: Load environment variables FIRST before any imports
// This ensures Config validation uses the correct values
import dotenv from 'dotenv'
import * as path from 'path'

if (process.env.NODE_ENV === 'test' && process.env.USE_ENV_FILE) {
  // Load .env.test for E2E tests
  const envTestPath = path.resolve(__dirname, '../.env.test')
  dotenv.config({ path: envTestPath })
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

const logger = new Logger('Server')

/**
 * Start server function
 * Clean, focused, single responsibility
 */
async function startServer() {
  try {
    logger.info('🚀 Starting server initialization...')
    logger.info(`Environment: ${Config.NODE_ENV}`)
    logger.info(`Service: ${Config.SERVICE_NAME} v${Config.SERVICE_VERSION}`)

    // Create app context (no global state!)
    const { fastify, container } = await createApp()

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

// Start the server
startServer()
