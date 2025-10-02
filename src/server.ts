import dotenv from 'dotenv'
dotenv.config()

import { createApp, getAppServiceRegistry, getContainer } from '@/app'
import { Logger } from '@/utils/logger'
import { Config } from '@/config'
import { FastifyInstance } from 'fastify'

const logger = new Logger('Server')

let fastify: FastifyInstance | undefined

// Start server function
async function startServer() {
  try {
    logger.info('Starting server initialization...')

    // Create and configure app
    fastify = await createApp()

    // Start the server
    const address = await fastify.listen({
      port: Config.PORT,
      host: Config.HOST || '0.0.0.0',
    })

    logger.info(`Server running on ${address}`)
    logger.info(`Swagger docs available at ${address}/docs`)

    // Service status
    const serviceRegistry = getAppServiceRegistry()
    const health = serviceRegistry.getHealth()

    logger.info('=== Services Status ===')
    logger.info(`Redis: ${health.redis ? '✅ Available' : '❌ Unavailable'}`)
    logger.info(`PostgreSQL: ${health.postgres ? '✅ Available' : '❌ Unavailable'}`)
    logger.info('=======================')

    // Print routes in development
    if (Config.NODE_ENV === 'development') {
      logger.info('\n=== Registered routes ===')
      logger.info(fastify.printRoutes())
      logger.info('========================\n')
    }
  } catch (error) {
    logger.error('Failed to start server', error)
    process.exit(1)
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, starting graceful shutdown`)

  try {
    // Close Fastify server
    if (fastify) {
      await fastify.close()
      logger.info('Fastify server closed')
    }

    // Shutdown services via registry
    const serviceRegistry = getAppServiceRegistry()
    if (serviceRegistry) {
      await serviceRegistry.shutdown()
    }

    // Dispose DI container
    const container = getContainer()
    if (container) {
      await container.dispose()
      logger.info('DI container disposed')
    }

    logger.info('Server closed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('Error during shutdown', error)
    process.exit(1)
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  logger.error('Uncaught exception', error)
  gracefulShutdown('UNCAUGHT_EXCEPTION')
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise })
  gracefulShutdown('UNHANDLED_REJECTION')
})

// Start the server
startServer()

// Export for testing
export default fastify
