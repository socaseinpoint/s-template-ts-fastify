import dotenv from 'dotenv'
dotenv.config()

import { createApp, isPostgresAvailable, isRedisAvailable, container } from '@/app'
import { Logger } from '@/utils/logger'
import { Config } from '@/config'
import { FastifyInstance } from 'fastify'

const logger = new Logger('Server')

let fastify: FastifyInstance

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
    logger.info('=== Services Status ===')
    logger.info(`Redis: ${isRedisAvailable ? '✅ Available' : '❌ Unavailable'}`)
    logger.info(`PostgreSQL: ${isPostgresAvailable ? '✅ Available' : '❌ Unavailable'}`)
    logger.info('=======================')

    // Print routes in development
    if (Config.NODE_ENV === 'development') {
      console.log('\n=== Registered routes ===')
      console.log(fastify.printRoutes())
      console.log('========================\n')
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
    }

    // Dispose DI container
    if (container) {
      await container.dispose()
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

// Start the server
startServer()

// Export for testing
export default fastify
