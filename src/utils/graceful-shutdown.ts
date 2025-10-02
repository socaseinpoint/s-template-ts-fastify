import { FastifyInstance } from 'fastify'
import { Logger } from '@/utils/logger'
import { DIContainer, disposeDIContainer } from '@/container'

const logger = new Logger('GracefulShutdown')

export interface ShutdownContext {
  fastify?: FastifyInstance
  container?: Awaited<DIContainer>
}

/**
 * Graceful shutdown handler
 * Properly closes all resources in the correct order
 */
export async function gracefulShutdown(signal: string, context: ShutdownContext): Promise<void> {
  logger.info(`${signal} received, starting graceful shutdown`)

  try {
    // 1. Stop accepting new requests
    if (context.fastify) {
      logger.info('Closing Fastify server...')
      await context.fastify.close()
      logger.info('✅ Fastify server closed')
    }

    // 2. Close all services and resources via DI container
    if (context.container) {
      await disposeDIContainer(context.container)
    }

    logger.info('✅ Graceful shutdown completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Error during graceful shutdown', error)
    process.exit(1)
  }
}

/**
 * Setup process signal handlers for graceful shutdown
 */
export function setupShutdownHandlers(context: ShutdownContext): void {
  // Handle SIGTERM (e.g., from Kubernetes, Docker)
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM', context))

  // Handle SIGINT (e.g., Ctrl+C)
  process.on('SIGINT', () => gracefulShutdown('SIGINT', context))
}
